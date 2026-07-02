import pool from '../config/db.js';
import { sendEscalationEmail, sendSubscriptionAlertEmail } from './emailService.js';

export function daysBetween(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

async function fireProjectEscalationAlert(project, rule, daysRemaining) {
  const [members] = await pool.execute(`
    SELECT u.id, u.name, u.email, np.email_enabled, np.in_app_enabled
    FROM project_members pm
    JOIN users u ON pm.user_id = u.id
    LEFT JOIN notification_preferences np ON np.user_id = u.id
    WHERE pm.project_id = ?
    AND u.status = 'active'
  `, [project.id]);

  const [admins] = await pool.execute(`
    SELECT id, name, email FROM users
    WHERE role IN ('super_admin', 'manager')
    AND status = 'active'
  `);

  const messagePrefix = daysRemaining < 0
    ? `OVERDUE by ${Math.abs(daysRemaining)} day(s)`
    : daysRemaining === 0
    ? 'due TODAY'
    : `${daysRemaining} day(s) remaining`;

  const message = `[${rule.rule_name}] Project "${project.name}" ${messagePrefix}`;

  for (const member of members) {
    if (member.in_app_enabled !== false) {
      await pool.execute(`
        INSERT INTO alerts (user_id, type, message, related_entity_type, related_entity_id)
        VALUES (?, 'escalation_alert', ?, 'project', ?)
      `, [member.id, message, project.id]);
    }

    if (member.email_enabled !== false) {
      await sendEscalationEmail({
        to: member.email,
        name: member.name,
        entityName: project.name,
        entityType: 'Project',
        ruleName: rule.rule_name,
        daysRemaining,
        isUrgent: rule.frequency === 'daily'
      });
    }
  }

  const memberNames = members.map(m => m.name).join(', ');

  for (const admin of admins) {
    await pool.execute(`
      INSERT INTO alerts (user_id, type, message, related_entity_type, related_entity_id)
      VALUES (?, 'escalation_alert', ?, 'project', ?)
    `, [
      admin.id,
      `[ADMIN] ${message}. Team: ${memberNames || 'No members'}`,
      project.id
    ]);

    await sendEscalationEmail({
      to: admin.email,
      name: admin.name,
      entityName: project.name,
      entityType: 'Project',
      ruleName: rule.rule_name,
      daysRemaining,
      isUrgent: rule.frequency === 'daily',
      isAdminAlert: true,
      memberNames
    });
  }
}

async function fireSubscriptionEscalationAlert(subscription, rule, daysRemaining) {
  const [admins] = await pool.execute(`
    SELECT id, name, email FROM users
    WHERE role IN ('super_admin', 'manager')
    AND status = 'active'
  `);

  const messagePrefix = daysRemaining < 0
    ? `EXPIRED ${Math.abs(daysRemaining)} day(s) ago`
    : `expires in ${daysRemaining} day(s)`;

  const message = `[${rule.rule_name}] Subscription "${subscription.name}" ${messagePrefix}`;

  for (const admin of admins) {
    await pool.execute(`
      INSERT INTO alerts (user_id, type, message, related_entity_type, related_entity_id)
      VALUES (?, 'escalation_alert', ?, 'subscription', ?)
    `, [admin.id, message, subscription.id]);

    await sendEscalationEmail({
      to: admin.email,
      name: admin.name,
      entityName: subscription.name,
      entityType: 'Subscription',
      ruleName: rule.rule_name,
      daysRemaining,
      isUrgent: rule.frequency === 'daily'
    });
  }

  const accountEmails = (subscription.account_email || '')
    .split(',')
    .map(e => e.trim())
    .filter(Boolean);

  for (const email of accountEmails) {
    await sendSubscriptionAlertEmail({
      to: email,
      name: email.split('@')[0],
      subscriptionName: subscription.name,
      category: subscription.category || 'other',
      provider: subscription.provider,
      expiryDate: subscription.expiry_date,
      daysRemaining,
      cost: subscription.cost,
      billingCycle: subscription.billing_cycle,
    });
  }

  const [linkedMembers] = await pool.execute(`
    SELECT DISTINCT u.id, u.name, u.email
    FROM subscription_projects sp
    JOIN project_members pm ON pm.project_id = sp.project_id
    JOIN users u ON u.id = pm.user_id
    WHERE sp.subscription_id = ?
    AND u.status = 'active'
    AND u.role NOT IN ('super_admin', 'manager')
  `, [subscription.id]);

  for (const member of linkedMembers) {
    await pool.execute(`
      INSERT INTO alerts (user_id, type, message, related_entity_type, related_entity_id)
      VALUES (?, 'escalation_alert', ?, 'subscription', ?)
    `, [member.id, message, subscription.id]);
  }
}

async function processEntityRules({ rules, entities, entityType, getDates }) {
  const percentageRules = rules.filter(r => r.trigger_type === 'percentage').sort((a, b) => a.display_order - b.display_order);
  const fixedDayRules = rules.filter(r => r.trigger_type === 'fixed_days').sort((a, b) => b.display_order - a.display_order);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const entity of entities) {
    const { startDate, endDate } = getDates(entity);
    const totalDuration = daysBetween(startDate, endDate);
    const elapsed = daysBetween(startDate, today);
    const daysRemaining = daysBetween(today, endDate);
    const percentElapsed = totalDuration > 0 ? (elapsed / totalDuration) * 100 : 100;

    let fired = false;

    for (const rule of percentageRules) {
      if (fired) break;
      const shouldFire = percentElapsed >= Number(rule.threshold_value);
      if (!shouldFire) continue;

      if (rule.frequency === 'once') {
        const [history] = await pool.execute(
          `SELECT id FROM escalation_alert_history WHERE rule_id = ? AND entity_type = ? AND entity_id = ?`,
          [rule.id, entityType, entity.id]
        );
        if (history.length > 0) continue;
      }
      if (rule.frequency === 'daily') {
        const [todayHistory] = await pool.execute(
          `SELECT id FROM escalation_alert_history WHERE rule_id = ? AND entity_type = ? AND entity_id = ? AND DATE(fired_at) = CURDATE()`,
          [rule.id, entityType, entity.id]
        );
        if (todayHistory.length > 0) continue;
      }

      if (entityType === 'project') {
        await fireProjectEscalationAlert(entity, rule, daysRemaining);
      } else {
        await fireSubscriptionEscalationAlert(entity, rule, daysRemaining);
      }
      await pool.execute(
        `INSERT INTO escalation_alert_history (rule_id, entity_type, entity_id) VALUES (?, ?, ?)`,
        [rule.id, entityType, entity.id]
      );
      fired = true;
    }

    for (const rule of fixedDayRules) {
      if (fired) break;
      const shouldFire = daysRemaining <= Number(rule.threshold_value);
      if (!shouldFire) continue;

      if (rule.frequency === 'once') {
        const [history] = await pool.execute(
          `SELECT id FROM escalation_alert_history WHERE rule_id = ? AND entity_type = ? AND entity_id = ?`,
          [rule.id, entityType, entity.id]
        );
        if (history.length > 0) continue;
      }
      if (rule.frequency === 'daily') {
        const [todayHistory] = await pool.execute(
          `SELECT id FROM escalation_alert_history WHERE rule_id = ? AND entity_type = ? AND entity_id = ? AND DATE(fired_at) = CURDATE()`,
          [rule.id, entityType, entity.id]
        );
        if (todayHistory.length > 0) continue;
      }

      if (entityType === 'project') {
        await fireProjectEscalationAlert(entity, rule, daysRemaining);
      } else {
        await fireSubscriptionEscalationAlert(entity, rule, daysRemaining);
      }
      await pool.execute(
        `INSERT INTO escalation_alert_history (rule_id, entity_type, entity_id) VALUES (?, ?, ?)`,
        [rule.id, entityType, entity.id]
      );
      fired = true;
    }
  }
}

export async function evaluateEscalationRules() {
  try {
    console.log('Running escalation rule engine...');

    const [rules] = await pool.execute(`
      SELECT * FROM alert_escalation_rules
      WHERE is_active = true
      ORDER BY display_order ASC
    `);

    if (rules.length === 0) {
      console.log('No active escalation rules found');
      return;
    }

    const projectRules = rules.filter(r => r.applies_to === 'projects' || r.applies_to === 'both');
    const subscriptionRules = rules.filter(r => r.applies_to === 'subscriptions' || r.applies_to === 'both');

    if (projectRules.length > 0) {
      const [projects] = await pool.execute(`
        SELECT id, name, start_date, deadline, created_by
        FROM projects
        WHERE deleted_at IS NULL
        AND status NOT IN ('completed', 'on_hold')
      `);

      await processEntityRules({
        rules: projectRules,
        entities: projects,
        entityType: 'project',
        getDates: (p) => ({ startDate: p.start_date, endDate: p.deadline }),
      });
    }

    if (subscriptionRules.length > 0) {
      const [subscriptions] = await pool.execute(`
        SELECT id, name, start_date, expiry_date, account_email, cost, billing_cycle, category, provider
        FROM subscriptions
        WHERE status = 'active'
      `);

      await processEntityRules({
        rules: subscriptionRules,
        entities: subscriptions,
        entityType: 'subscription',
        getDates: (s) => ({ startDate: s.start_date, endDate: s.expiry_date }),
      });

      for (const sub of subscriptions) {
        const daysRemaining = daysBetween(new Date(), sub.expiry_date);
        if (daysRemaining < 0) {
          await pool.execute(`UPDATE subscriptions SET status = 'expired' WHERE id = ?`, [sub.id]);
        }
      }
    }

    console.log('Escalation rule engine completed');
  } catch (error) {
    console.error('Escalation rule engine error:', error);
  }
}
