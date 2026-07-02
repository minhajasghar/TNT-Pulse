import cron from 'node-cron';
import pool from '../config/db.js';
import { sendDeadlineWarningEmail, sendTaskOverdueEmail, sendTaskAssignedEmail, sendSubscriptionAlertEmail, sendBatchedSubscriptionAlertEmail } from './emailService.js';
import { evaluateEscalationRules } from './escalationEngine.js';

const alertAlreadySentToday = async (userId, type, entityType, entityId) => {
  let query;
  let params;

  if (userId === null) {
    query = `SELECT id FROM alerts
       WHERE type = ? AND related_entity_type = ? AND related_entity_id = ?
         AND DATE(created_at) = CURDATE()`;
    params = [type, entityType, entityId];
  } else {
    query = `SELECT id FROM alerts
       WHERE user_id = ? AND type = ? AND related_entity_type = ? AND related_entity_id = ?
         AND DATE(created_at) = CURDATE()`;
    params = [userId, type, entityType, entityId];
  }

  const [rows] = await pool.execute(query, params);
  return rows.length > 0;
};

const insertAlert = async (userId, type, message, entityType, entityId) => {
  await pool.execute(
    'INSERT INTO alerts (user_id, type, message, related_entity_type, related_entity_id) VALUES (?, ?, ?, ?, ?)',
    [userId, type, message, entityType, entityId],
  );
};

const getNotificationPrefs = async (userId) => {
  const [rows] = await pool.execute(
    'SELECT email_enabled, in_app_enabled, alert_days_before_deadline FROM notification_preferences WHERE user_id = ?',
    [userId],
  );
  return rows[0] || { email_enabled: true, in_app_enabled: true, alert_days_before_deadline: 3 };
};

const getUser = async (userId) => {
  const [rows] = await pool.execute('SELECT id, name, email FROM users WHERE id = ?', [userId]);
  return rows[0] || null;
};

const checkDeadlineWarnings = async () => {
  try {
    console.log('Running deadline check...');

    const [projects] = await pool.execute(`
      SELECT 
        p.id, p.name, p.deadline,
        p.created_by,
        DATEDIFF(p.deadline, CURDATE()) as days_remaining
      FROM projects p
      WHERE p.deleted_at IS NULL
        AND p.status NOT IN ('completed', 'on_hold')
        AND DATEDIFF(p.deadline, CURDATE()) <= 7
    `);

    const [admins] = await pool.execute(`
      SELECT id, name, email 
      FROM users 
      WHERE role = 'super_admin' 
        AND status = 'active'
    `);

    let alertCount = 0;

    for (const project of projects) {
      const [members] = await pool.execute(`
        SELECT 
          u.id, u.name, u.email,
          np.email_enabled,
          np.in_app_enabled,
          np.alert_days_before_deadline
        FROM project_members pm
        JOIN users u ON pm.user_id = u.id
        LEFT JOIN notification_preferences np ON np.user_id = u.id
        WHERE pm.project_id = ?
          AND u.status = 'active'
      `, [project.id]);

      for (const member of members) {
        const threshold = member.alert_days_before_deadline || 3;

        if (project.days_remaining > threshold) continue;

        const [existing] = await pool.execute(`
          SELECT id FROM alerts 
          WHERE user_id = ?
            AND type = 'deadline_warning'
            AND related_entity_id = ?
            AND DATE(created_at) = CURDATE()
        `, [member.id, project.id]);

        if (existing.length > 0) continue;

        if (member.in_app_enabled !== false) {
          await pool.execute(`
            INSERT INTO alerts 
            (user_id, type, message, related_entity_type, related_entity_id)
            VALUES (?, ?, ?, 'project', ?)
          `, [
            member.id,
            'deadline_warning',
            `Project "${project.name}" deadline in ${project.days_remaining} day(s)`,
            project.id,
          ]);
          alertCount++;
        }

        if (member.email_enabled !== false) {
          await sendDeadlineWarningEmail({
            to: member.email,
            name: member.name,
            projectName: project.name,
            deadline: project.deadline,
            daysRemaining: project.days_remaining,
          });
        }
      }

      for (const admin of admins) {
        const [existing] = await pool.execute(`
          SELECT id FROM alerts
          WHERE user_id = ?
            AND type = 'admin_deadline_warning'
            AND related_entity_id = ?
            AND DATE(created_at) = CURDATE()
        `, [admin.id, project.id]);

        if (existing.length > 0) continue;

        const memberNames = members.map(m => m.name).join(', ');

        await pool.execute(`
          INSERT INTO alerts
          (user_id, type, message, related_entity_type, related_entity_id)
          VALUES (?, ?, ?, 'project', ?)
        `, [
          admin.id,
          'admin_deadline_warning',
          `ADMIN ALERT: Project "${project.name}" expires in ${project.days_remaining} day(s). Members: ${memberNames}`,
          project.id,
        ]);

        await sendDeadlineWarningEmail({
          to: admin.email,
          name: admin.name,
          projectName: project.name,
          deadline: project.deadline,
          daysRemaining: project.days_remaining,
          isAdminAlert: true,
          memberNames: memberNames,
        });
      }
    }

    console.log(`Deadline check complete. ${alertCount} alerts sent.`);
  } catch (error) {
    console.error('Deadline check error:', error);
  }
};

const checkOverdueTasks = async () => {
  console.log('[Cron] checkOverdueTasks — started');

  try {
    const [tasks] = await pool.execute(
      `SELECT t.id, t.title, t.due_date, t.project_id, p.name AS project_name, t.assigned_to
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       WHERE t.due_date < CURDATE() AND t.status != 'done' AND t.assigned_to IS NOT NULL`,
    );

    if (tasks.length === 0) {
      console.log('[Cron] checkOverdueTasks — no overdue tasks');
      return;
    }

    let alertCount = 0;

    for (const task of tasks) {
      const user = await getUser(task.assigned_to);
      if (!user || user.status === 'suspended') continue;

      const alreadySent = await alertAlreadySentToday(task.assigned_to, 'task_overdue', 'task', task.id);
      if (alreadySent) continue;

      const prefs = await getNotificationPrefs(task.assigned_to);

      await insertAlert(
        task.assigned_to,
        'task_overdue',
        `Task "${task.title}" in project "${task.project_name}" is overdue`,
        'task',
        task.id,
      );
      alertCount++;

      if (prefs.email_enabled) {
        await sendTaskOverdueEmail({
          to: user.email,
          name: user.name,
          taskTitle: task.title,
          projectName: task.project_name,
          dueDate: task.due_date,
        });
      }
    }

    console.log(`[Cron] checkOverdueTasks — completed: ${alertCount} alerts sent`);
  } catch (err) {
    console.error(`[Cron] checkOverdueTasks — error: ${err.message}`);
  }
};

const checkUpcomingTaskDeadlines = async () => {
  console.log('[Cron] checkUpcomingTaskDeadlines — started');

  try {
    const [tasks] = await pool.execute(
      `SELECT t.id, t.title, t.due_date, t.project_id, p.name AS project_name, t.assigned_to
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       WHERE t.due_date IS NOT NULL AND t.status != 'done' AND t.assigned_to IS NOT NULL`,
    );

    if (tasks.length === 0) {
      console.log('[Cron] checkUpcomingTaskDeadlines — no active tasks with deadlines');
      return;
    }

    let alertCount = 0;

    for (const task of tasks) {
      const daysRemaining = Math.floor(
        (new Date(task.due_date) - new Date(new Date().toDateString())) / (1000 * 60 * 60 * 24),
      );

      if (daysRemaining < 0) continue;

      const user = await getUser(task.assigned_to);
      if (!user || user.status === 'suspended') continue;

      const prefs = await getNotificationPrefs(task.assigned_to);

      if (daysRemaining !== prefs.alert_days_before_deadline) continue;

      const alreadySent = await alertAlreadySentToday(task.assigned_to, 'task_deadline_warning', 'task', task.id);
      if (alreadySent) continue;

      if (prefs.in_app_enabled) {
        await insertAlert(
          task.assigned_to,
          'task_deadline_warning',
          `Task "${task.title}" in project "${task.project_name}" is due in ${daysRemaining} days`,
          'task',
          task.id,
        );
        alertCount++;
      }

      if (prefs.email_enabled) {
        await sendTaskAssignedEmail({
          to: user.email,
          name: user.name,
          taskTitle: task.title,
          projectName: task.project_name,
          dueDate: task.due_date,
          assignedBy: 'TNT Innovations System',
        });
      }
    }

    console.log(`[Cron] checkUpcomingTaskDeadlines — completed: ${alertCount} alerts sent`);
  } catch (err) {
    console.error(`[Cron] checkUpcomingTaskDeadlines — error: ${err.message}`);
  }
};

export const checkSubscriptionExpiryAlerts = async (specificSubscriptionId = null) => {
  try {
    console.log(`[Cron] checkSubscriptionExpiryAlerts — started${specificSubscriptionId ? ` for ID ${specificSubscriptionId}` : ''}`);

    let query = `
      SELECT s.*, DATEDIFF(s.expiry_date, CURDATE()) as days_remaining
      FROM subscriptions s
      WHERE s.status = 'active'
        AND DATEDIFF(s.expiry_date, CURDATE()) <= s.alert_days_before
    `;
    const params = [];

    if (specificSubscriptionId) {
      query += ` AND s.id = ?`;
      params.push(specificSubscriptionId);
    }

    const [subscriptions] = await pool.execute(query, params);

    if (subscriptions.length === 0) {
      console.log('[Cron] checkSubscriptionExpiryAlerts — no subscriptions needing alerts');
      return;
    }

    const emailGroups = {};
    const subsToAlert = [];

    // Filter and group subscriptions
    for (const sub of subscriptions) {
      const alreadySent = await alertAlreadySentToday(null, 'subscription_expiry', 'subscription', sub.id);
      if (alreadySent) continue;
      
      subsToAlert.push(sub);

      const emails = (sub.account_email || '').split(',').map(e => e.trim()).filter(Boolean);
      if (emails.length === 0) {
        console.log(`[Cron] Subscription #${sub.id} "${sub.name}" has no alert emails`);
      }

      for (const email of emails) {
        if (!emailGroups[email]) {
          emailGroups[email] = [];
        }
        emailGroups[email].push({
          id: sub.id,
          subscriptionName: sub.name,
          category: sub.category,
          provider: sub.provider,
          expiryDate: sub.expiry_date,
          daysRemaining: sub.days_remaining,
          cost: sub.cost,
          billingCycle: sub.billing_cycle,
        });
      }
    }

    if (subsToAlert.length === 0) {
      console.log('[Cron] checkSubscriptionExpiryAlerts — alerts already sent for today');
      return;
    }

    let emailCount = 0;

    // Send batched emails
    for (const [email, userSubs] of Object.entries(emailGroups)) {
      try {
        await sendBatchedSubscriptionAlertEmail({
          to: email,
          name: email.split('@')[0],
          subscriptions: userSubs,
        });
        emailCount++;
        console.log(`[Cron] Sent batched subscription alert to ${email} for ${userSubs.length} subscriptions`);
      } catch (err) {
        console.error(`[Cron] Failed to send batched email to ${email}: ${err.message}`);
      }
    }

    // Insert database alerts for the subscriptions processed
    for (const sub of subsToAlert) {
      const daysRemaining = sub.days_remaining;
      const alertMessage = daysRemaining < 0
        ? `Subscription "${sub.name}" expired ${Math.abs(daysRemaining)} day(s) ago`
        : `Subscription "${sub.name}" expires in ${daysRemaining} day(s)`;

      await pool.execute(`
        INSERT INTO alerts (user_id, type, message, related_entity_type, related_entity_id)
        VALUES (?, 'subscription_expiry', ?, 'subscription', ?)
      `, [null, alertMessage, sub.id]);

      const [admins] = await pool.execute(`
        SELECT id, name, email FROM users
        WHERE role IN ('super_admin', 'manager')
          AND status = 'active'
      `);

      for (const admin of admins) {
        const adminAlreadySent = await alertAlreadySentToday(admin.id, 'subscription_expiry', 'subscription', sub.id);
        if (adminAlreadySent) continue;

        await pool.execute(`
          INSERT INTO alerts (user_id, type, message, related_entity_type, related_entity_id)
          VALUES (?, 'subscription_expiry', ?, 'subscription', ?)
        `, [admin.id, `[ADMIN] ${alertMessage}`, sub.id]);
      }
    }

    console.log(`[Cron] checkSubscriptionExpiryAlerts — completed: ${emailCount} batched emails sent`);
  } catch (error) {
    console.error('[Cron] checkSubscriptionExpiryAlerts — error:', error.message);
  }
};

export const initCronJobs = () => {
  checkDeadlineWarnings();

  cron.schedule('0 8 * * *', async () => {
    await evaluateEscalationRules();
  });

  cron.schedule('0 0 * * *', () => {
    checkSubscriptionExpiryAlerts();
  });

  cron.schedule('30 8 * * *', () => {
    checkOverdueTasks();
  });

  cron.schedule('0 9 * * *', () => {
    checkUpcomingTaskDeadlines();
  });

  console.log('TNT Innovations cron jobs initialized');
};
