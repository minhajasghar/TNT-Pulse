import pool from '../config/db.js';

const logActivity = async (userId, action, entityType, entityId, oldValue, newValue, ipAddress) => {
  try {
    await pool.execute(
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, old_value, new_value, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, action, entityType, entityId, oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null, ipAddress || null],
    );
  } catch (err) {
    console.error('Failed to log activity:', err.message);
  }
};

export const createSubscription = async (req, res) => {
  try {
    const {
      name, category, provider, description, cost, billing_cycle, currency,
      start_date, expiry_date, alert_days_before = 7, auto_renew, account_email, notes,
      linked_project_ids = []
    } = req.body;

    const [result] = await pool.execute(
      `INSERT INTO subscriptions (
        name, category, provider, description, cost, billing_cycle, currency, 
        start_date, expiry_date, alert_days_before, auto_renew, account_email, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name, category, provider || null, description || null, cost || 0, billing_cycle || 'monthly', currency || 'USD',
        start_date, expiry_date, alert_days_before, auto_renew ? 1 : 0, account_email || null, notes || null, req.user.id
      ]
    );

    const subscriptionId = result.insertId;

    if (linked_project_ids.length > 0) {
      for (const projectId of linked_project_ids) {
        await pool.execute(
          'INSERT INTO subscription_projects (subscription_id, project_id) VALUES (?, ?)',
          [subscriptionId, projectId]
        );
      }
    }

    await logActivity(
      req.user.id,
      'create_subscription',
      'subscription',
      subscriptionId,
      null,
      { name, category, cost, billing_cycle },
      req.ip
    );

    const [newSub] = await pool.execute('SELECT * FROM subscriptions WHERE id = ?', [subscriptionId]);

    res.status(201).json({ success: true, subscription: newSub[0] });
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({ success: false, message: 'Server error creating subscription' });
  }
};

export const getAllSubscriptions = async (req, res) => {
  try {
    const { category, status } = req.query;
    const isSuperOrManager = ['super_admin', 'manager'].includes(req.user.role);

    let query = `
      SELECT DISTINCT s.*,
        DATEDIFF(s.expiry_date, CURDATE()) as days_remaining,
        (DATEDIFF(s.expiry_date, CURDATE()) < 0) as is_expired
      FROM subscriptions s
    `;

    const params = [];

    if (!isSuperOrManager) {
      query += `
        JOIN subscription_projects sp ON sp.subscription_id = s.id
        JOIN project_members pm ON pm.project_id = sp.project_id
        WHERE pm.user_id = ?
      `;
      params.push(req.user.id);
    } else {
      query += ` WHERE 1=1 `;
    }

    if (category) {
      query += ` AND s.category = ? `;
      params.push(category);
    }

    if (status) {
      query += ` AND s.status = ? `;
      params.push(status);
    }

    query += ` ORDER BY s.expiry_date ASC `;

    const [subscriptions] = await pool.execute(query, params);

    for (const sub of subscriptions) {
      const [projects] = await pool.execute(
        `SELECT p.id, p.name 
         FROM projects p
         JOIN subscription_projects sp ON sp.project_id = p.id
         WHERE sp.subscription_id = ?`,
        [sub.id]
      );
      sub.linked_projects = projects;
      sub.is_expired = !!sub.is_expired; // Convert 1/0 to boolean
    }

    res.json({ success: true, subscriptions });
  } catch (error) {
    console.error('Error getting subscriptions:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving subscriptions' });
  }
};

export const getSubscriptionById = async (req, res) => {
  try {
    const { id } = req.params;
    const isSuperOrManager = ['super_admin', 'manager'].includes(req.user.role);

    const [subscriptions] = await pool.execute(
      `SELECT s.*, DATEDIFF(s.expiry_date, CURDATE()) as days_remaining
       FROM subscriptions s WHERE s.id = ?`,
      [id]
    );

    if (subscriptions.length === 0) {
      return res.status(404).json({ success: false, message: 'Subscription not found' });
    }

    const subscription = subscriptions[0];

    const [projects] = await pool.execute(
      `SELECT p.id, p.name 
       FROM projects p
       JOIN subscription_projects sp ON sp.project_id = p.id
       WHERE sp.subscription_id = ?`,
      [id]
    );

    subscription.linked_projects = projects;

    if (!isSuperOrManager) {
      const [membership] = await pool.execute(
        `SELECT 1 FROM project_members pm
         JOIN subscription_projects sp ON sp.project_id = pm.project_id
         WHERE pm.user_id = ? AND sp.subscription_id = ? LIMIT 1`,
        [req.user.id, id]
      );
      
      if (membership.length === 0) {
        return res.status(403).json({ success: false, message: 'Not authorized to view this subscription' });
      }
    }

    res.json({ success: true, subscription });
  } catch (error) {
    console.error('Error getting subscription by id:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving subscription' });
  }
};

export const updateSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const [oldSubs] = await pool.execute('SELECT * FROM subscriptions WHERE id = ?', [id]);
    if (oldSubs.length === 0) {
      return res.status(404).json({ success: false, message: 'Subscription not found' });
    }
    const oldSub = oldSubs[0];

    const updatableFields = [
      'name', 'category', 'provider', 'description', 'cost', 'billing_cycle', 
      'currency', 'start_date', 'expiry_date', 'alert_days_before', 'auto_renew', 
      'status', 'account_email', 'notes'
    ];

    const fieldsToUpdate = [];
    const values = [];

    for (const field of updatableFields) {
      if (updates[field] !== undefined) {
        fieldsToUpdate.push(`${field} = ?`);
        values.push(field === 'auto_renew' ? (updates[field] ? 1 : 0) : updates[field]);
      }
    }

    if (fieldsToUpdate.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields provided to update' });
    }

    values.push(id);
    await pool.execute(
      `UPDATE subscriptions SET ${fieldsToUpdate.join(', ')} WHERE id = ?`,
      values
    );

    await logActivity(
      req.user.id,
      'update_subscription',
      'subscription',
      id,
      oldSub,
      updatedSub[0],
      req.ip
    );

    const [updatedSub] = await pool.execute('SELECT * FROM subscriptions WHERE id = ?', [id]);

    res.json({ success: true, subscription: updatedSub[0] });
  } catch (error) {
    console.error('Error updating subscription:', error);
    res.status(500).json({ success: false, message: 'Server error updating subscription' });
  }
};

export const deleteSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const [oldSubsForDelete] = await pool.execute('SELECT * FROM subscriptions WHERE id = ?', [id]);
    const oldSubForDelete = oldSubsForDelete[0];
    
    await pool.execute('DELETE FROM subscriptions WHERE id = ?', [id]);
    
    if (oldSubForDelete) {
      await logActivity(
        req.user.id,
        'delete_subscription',
        'subscription',
        id,
        { name: oldSubForDelete.name, category: oldSubForDelete.category },
        null,
        req.ip
      );
    }

    res.json({ success: true, message: 'Subscription deleted successfully' });
  } catch (error) {
    console.error('Error deleting subscription:', error);
    res.status(500).json({ success: false, message: 'Server error deleting subscription' });
  }
};

export const linkProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { project_id } = req.body;

    if (!project_id) {
       return res.status(400).json({ success: false, message: 'project_id is required' });
    }

    const [existing] = await pool.execute(
      'SELECT id FROM subscription_projects WHERE subscription_id = ? AND project_id = ?',
      [id, project_id]
    );

    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Project already linked to this subscription' });
    }

    await pool.execute(
      'INSERT INTO subscription_projects (subscription_id, project_id) VALUES (?, ?)',
      [id, project_id]
    );

    res.json({ success: true, message: 'Project linked successfully' });
  } catch (error) {
    console.error('Error linking project:', error);
    res.status(500).json({ success: false, message: 'Server error linking project' });
  }
};

export const unlinkProject = async (req, res) => {
  try {
    const { id, projectId } = req.params;

    await pool.execute(
      'DELETE FROM subscription_projects WHERE subscription_id = ? AND project_id = ?',
      [id, projectId]
    );

    res.json({ success: true, message: 'Project unlinked successfully' });
  } catch (error) {
    console.error('Error unlinking project:', error);
    res.status(500).json({ success: false, message: 'Server error unlinking project' });
  }
};

export const getProjectSubscriptions = async (req, res) => {
  try {
    const { project_id } = req.params;

    const [subscriptions] = await pool.execute(
      `SELECT s.*, DATEDIFF(s.expiry_date, CURDATE()) as days_remaining
       FROM subscriptions s
       JOIN subscription_projects sp ON sp.subscription_id = s.id
       WHERE sp.project_id = ?
       ORDER BY s.expiry_date ASC`,
      [project_id]
    );

    res.json({ success: true, subscriptions });
  } catch (error) {
    console.error('Error getting project subscriptions:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving project subscriptions' });
  }
};

export const getExpiringStats = async (req, res) => {
  try {
    const [stats] = await pool.execute(`
      SELECT 
        SUM(CASE WHEN DATEDIFF(expiry_date, CURDATE()) BETWEEN 0 AND 7 THEN 1 ELSE 0 END) as expiring_this_week,
        SUM(CASE WHEN DATEDIFF(expiry_date, CURDATE()) BETWEEN 0 AND 30 THEN 1 ELSE 0 END) as expiring_this_month,
        SUM(CASE WHEN DATEDIFF(expiry_date, CURDATE()) < 0 THEN 1 ELSE 0 END) as already_expired,
        SUM(CASE WHEN billing_cycle = 'monthly' THEN cost ELSE 0 END) as total_monthly_cost,
        SUM(CASE WHEN billing_cycle = 'yearly' THEN cost ELSE 0 END) as yearly_cost_raw
      FROM subscriptions
      WHERE status != 'cancelled'
    `);

    const result = stats[0] || {};
    const total_monthly = Number(result.total_monthly_cost || 0);
    const yearly_raw = Number(result.yearly_cost_raw || 0);

    res.json({ 
      success: true, 
      stats: {
        expiring_this_week: Number(result.expiring_this_week || 0),
        expiring_this_month: Number(result.expiring_this_month || 0),
        already_expired: Number(result.already_expired || 0),
        total_monthly_cost: total_monthly,
        total_yearly_cost: (total_monthly * 12) + yearly_raw
      }
    });
  } catch (error) {
    console.error('Error getting expiring stats:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving stats' });
  }
};
