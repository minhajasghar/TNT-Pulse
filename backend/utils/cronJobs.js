import cron from 'node-cron';
import pool from '../config/db.js';
import { sendDeadlineWarningEmail, sendTaskOverdueEmail, sendTaskAssignedEmail } from './emailService.js';

const alertAlreadySentToday = async (userId, type, entityType, entityId) => {
  const [rows] = await pool.execute(
    `SELECT id FROM alerts
     WHERE user_id = ? AND type = ? AND related_entity_type = ? AND related_entity_id = ?
       AND DATE(created_at) = CURDATE()`,
    [userId, type, entityType, entityId],
  );
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
  console.log('[Cron] checkDeadlineWarnings — started');

  try {
    const [projects] = await pool.execute(
      "SELECT id, name, deadline FROM projects WHERE status NOT IN ('completed', 'on_hold') AND deadline IS NOT NULL",
    );

    if (projects.length === 0) {
      console.log('[Cron] checkDeadlineWarnings — no active projects with deadlines');
      return;
    }

    let warningCount = 0;
    let overdueCount = 0;

    for (const project of projects) {
      const daysRemaining = Math.floor(
        (new Date(project.deadline) - new Date(new Date().toDateString())) / (1000 * 60 * 60 * 24),
      );

      const [members] = await pool.execute(
        'SELECT user_id FROM project_members WHERE project_id = ?',
        [project.id],
      );

      for (const member of members) {
        const prefs = await getNotificationPrefs(member.user_id);
        const user = await getUser(member.user_id);
        if (!user || user.status === 'suspended') continue;

        if (daysRemaining <= 0) {
          const alreadySent = await alertAlreadySentToday(member.user_id, 'project_overdue', 'project', project.id);
          if (!alreadySent) {
            await insertAlert(
              member.user_id,
              'project_overdue',
              `Project "${project.name}" is overdue by ${Math.abs(daysRemaining)} days`,
              'project',
              project.id,
            );
            overdueCount++;

            if (prefs.email_enabled) {
              await sendDeadlineWarningEmail({
                to: user.email,
                name: user.name,
                projectName: project.name,
                deadline: project.deadline,
                daysRemaining,
              });
            }
          }
        } else if (daysRemaining === prefs.alert_days_before_deadline) {
          const alreadySent = await alertAlreadySentToday(member.user_id, 'deadline_warning', 'project', project.id);
          if (!alreadySent) {
            await insertAlert(
              member.user_id,
              'deadline_warning',
              `Project "${project.name}" deadline is in ${daysRemaining} days (${project.deadline})`,
              'project',
              project.id,
            );
            warningCount++;

            if (prefs.email_enabled) {
              await sendDeadlineWarningEmail({
                to: user.email,
                name: user.name,
                projectName: project.name,
                deadline: project.deadline,
                daysRemaining,
              });
            }
          }
        }
      }
    }

    console.log(`[Cron] checkDeadlineWarnings — completed: ${warningCount} warnings, ${overdueCount} overdues sent`);
  } catch (err) {
    console.error(`[Cron] checkDeadlineWarnings — error: ${err.message}`);
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

export const initCronJobs = () => {
  cron.schedule('0 8 * * *', () => {
    checkDeadlineWarnings();
  });

  cron.schedule('30 8 * * *', () => {
    checkOverdueTasks();
  });

  cron.schedule('0 9 * * *', () => {
    checkUpcomingTaskDeadlines();
  });

  console.log('TNT Innovations cron jobs initialized');
};
