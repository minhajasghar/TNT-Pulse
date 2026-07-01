import pool from '../config/db.js';

const logActivity = async (userId, action, entityType, entityId, oldValue, newValue, ipAddress) => {
  await pool.execute(
    'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, old_value, new_value, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [userId, action, entityType, entityId, oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null, ipAddress],
  );
};

export const createProject = async (req, res) => {
  try {
    console.log('createProject called');
    console.log('Body:', req.body);
    console.log('User:', req.user);

    const {
      name,
      description,
      client_name,
      start_date,
      deadline,
      priority,
      status = 'planning',
      members = [],
      existing_subscription_ids = [],
      new_subscriptions = [],
    } = req.body;

    console.log('Fields:', { name, client_name, start_date, deadline, priority });

    // Validation
    const missing = [];
    if (!name) missing.push('name');
    if (!client_name) missing.push('client_name');
    if (!start_date) missing.push('start_date');
    if (!deadline) missing.push('deadline');
    if (!priority) missing.push('priority');

    if (missing.length > 0) {
      console.log('Missing fields:', missing);
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missing.join(', ')}`,
      });
    }

    // Insert project
    const [result] = await pool.execute(
      `INSERT INTO projects (name, description, client_name, start_date, deadline, priority, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, description || null, client_name, start_date, deadline, priority, status, req.user.id],
    );

    console.log('Project created:', result.insertId);

    const projectId = result.insertId;

    // Add members (safe)
    if (members && members.length > 0) {
      console.log('Adding members:', members);
      for (const m of members) {
        try {
          await pool.execute(
            'INSERT INTO project_members (project_id, user_id, project_role) VALUES (?, ?, ?)',
            [projectId, m.user_id, m.project_role || 'Member'],
          );
        } catch (memberErr) {
          console.log('Member insert with project_role failed, trying without:', memberErr.message);
          await pool.execute(
            'INSERT INTO project_members (project_id, user_id) VALUES (?, ?)',
            [projectId, m.user_id],
          );
        }
      }
    }

    // Activity log (safe)
    try {
      await pool.execute(
        'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, new_value, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
        [req.user.id, 'project_created', 'project', projectId, JSON.stringify({ name, priority, status }), req.ip],
      );
    } catch (logErr) {
      console.error('Activity log failed:', logErr.message);
    }

    // Subscriptions handling
    if (existing_subscription_ids && existing_subscription_ids.length > 0) {
      for (const subId of existing_subscription_ids) {
        await pool.execute(
          `INSERT IGNORE INTO subscription_projects (subscription_id, project_id) VALUES (?, ?)`,
          [subId, projectId]
        );
      }
    }

    if (new_subscriptions && new_subscriptions.length > 0) {
      for (const sub of new_subscriptions) {
        const [subResult] = await pool.execute(
          `INSERT INTO subscriptions
          (name, category, provider, start_date, expiry_date, cost, currency, billing_cycle, alert_days_before, auto_renew, status, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
          [
            sub.name, sub.category,
            sub.provider || null,
            sub.start_date, sub.expiry_date,
            sub.cost || 0, 
            sub.currency || 'USD',
            sub.billing_cycle || 'monthly',
            sub.alert_days_before || 7,
            sub.auto_renew ? 1 : 0,
            req.user.id
          ]
        );

        await pool.execute(
          `INSERT INTO subscription_projects (subscription_id, project_id) VALUES (?, ?)`,
          [subResult.insertId, projectId]
        );
      }
    }

    const [projectRows] = await pool.execute('SELECT * FROM projects WHERE id = ?', [projectId]);

    return res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data: projectRows[0],
    });
  } catch (error) {
    console.error('createProject ERROR:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to create project',
    });
  }
};

export const getAllProjects = async (req, res, next) => {
  try {
    let query = `SELECT p.*,
                  (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) AS member_count,
                  (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status != 'done') AS active_tasks
                 FROM projects p WHERE p.deleted_at IS NULL`;
    const params = [];

    if (req.query.status) {
      query += ' AND p.status = ?';
      params.push(req.query.status);
    }

    if (req.query.priority) {
      query += ' AND p.priority = ?';
      params.push(req.query.priority);
    }

    if (req.query.search) {
      query += ' AND (p.name LIKE CONCAT("%", ?, "%") OR p.client_name LIKE CONCAT("%", ?, "%"))';
      params.push(req.query.search, req.query.search);
    }

    query += ' ORDER BY p.created_at DESC';

    const [projects] = await pool.execute(query, params);

    return res.status(200).json({ success: true, data: projects });
  } catch (err) {
    next(err);
  }
};

export const getProjectById = async (req, res, next) => {
  try {
    const [projectRows] = await pool.execute(`
      SELECT p.*, u.name as created_by_name
      FROM projects p
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.id = ? AND p.deleted_at IS NULL
    `, [req.params.id]);

    if (projectRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const project = projectRows[0];

    // Get Members
    let members;
    try {
      const [m] = await pool.execute(`
        SELECT 
          pm.project_role,
          pm.assigned_at,
          u.id as id, u.id as user_id, u.name, u.email, 
          u.role, u.status
        FROM project_members pm
        JOIN users u ON pm.user_id = u.id
        WHERE pm.project_id = ?
      `, [req.params.id]);
      members = m;
    } catch (roleErr) {
      const [m] = await pool.execute(`
        SELECT 
          'Member' as project_role,
          pm.assigned_at,
          u.id as id, u.id as user_id, u.name, u.email, 
          u.role, u.status
        FROM project_members pm
        JOIN users u ON pm.user_id = u.id
        WHERE pm.project_id = ?
      `, [req.params.id]);
      members = m;
    }

    // Get Milestones
    const [milestones] = await pool.execute(`
      SELECT * FROM milestones 
      WHERE project_id = ?
      ORDER BY due_date ASC
    `, [req.params.id]);

    // Get Requirements
    const [requirements] = await pool.execute(`
      SELECT r.*, u.name as created_by_name
      FROM requirements r
      LEFT JOIN users u ON r.created_by = u.id
      WHERE r.project_id = ?
    `, [req.params.id]);

    // Get Tasks
    const [tasks] = await pool.execute(`
      SELECT t.*, u.name as assignee_name
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.project_id = ?
      ORDER BY t.created_at DESC
    `, [req.params.id]);

    return res.json({
      success: true,
      data: {
        ...project,
        members,
        milestones,
        requirements,
        tasks,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const updateProject = async (req, res, next) => {
  try {
    const [existing] = await pool.execute('SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const project = existing[0];
    const allowedFields = ['name', 'description', 'client_name', 'start_date', 'deadline', 'status', 'priority'];
    const updates = {};
    const changes = [];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
        changes.push({ field, old: project[field], new: req.body[field] });
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    const setClauses = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const updateValues = Object.values(updates);

    await pool.execute(`UPDATE projects SET ${setClauses} WHERE id = ?`, [...updateValues, req.params.id]);

    const oldData = {};
    const newData = {};
    for (const change of changes) {
      oldData[change.field] = change.old;
      newData[change.field] = change.new;
    }

    await logActivity(req.user.id, 'update_project', 'project', req.params.id, oldData, newData, req.ip);

    const [updated] = await pool.execute('SELECT * FROM projects WHERE id = ?', [req.params.id]);

    return res.status(200).json({ success: true, message: 'Project updated', data: updated[0] });
  } catch (err) {
    next(err);
  }
};

export const deleteProject = async (req, res, next) => {
  try {
    const [existing] = await pool.execute('SELECT id, name FROM projects WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    await pool.execute('UPDATE projects SET deleted_at = NOW(), deleted_by = ? WHERE id = ?', [req.user.id, req.params.id]);

    await logActivity(req.user.id, 'delete_project_soft', 'project', req.params.id, { name: existing[0].name }, null, req.ip);

    return res.status(200).json({ success: true, message: 'Project moved to recycle bin' });
  } catch (err) {
    next(err);
  }
};

export const addMember = async (req, res) => {
  try {
    console.log('addMember called');
    console.log('Params:', req.params);
    console.log('Body:', req.body);

    const project_id = req.params.id;
    const { user_id, project_role } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: 'user_id is required',
      });
    }

    // Check project exists
    const [projects] = await pool.execute(
      'SELECT id, name FROM projects WHERE id = ? AND deleted_at IS NULL',
      [project_id],
    );

    if (!projects.length) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    // Check user exists
    const [users] = await pool.execute(
      'SELECT id, name FROM users WHERE id = ? AND status = ?',
      [user_id, 'active'],
    );

    if (!users.length) {
      return res.status(404).json({
        success: false,
        message: 'User not found or suspended',
      });
    }

    // Check already member
    const [existing] = await pool.execute(
      'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?',
      [project_id, user_id],
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: `${users[0].name} is already in this project`,
      });
    }

    // Try insert with project_role, fallback without
    try {
      await pool.execute(
        'INSERT INTO project_members (project_id, user_id, project_role) VALUES (?, ?, ?)',
        [project_id, user_id, project_role || 'Member'],
      );
    } catch (insertError) {
      console.log('project_role column may not exist, trying without it');
      await pool.execute(
        'INSERT INTO project_members (project_id, user_id) VALUES (?, ?)',
        [project_id, user_id],
      );
    }

    console.log('Member added successfully');

    return res.status(200).json({
      success: true,
      message: `${users[0].name} added to project successfully`,
      data: {
        user_id,
        name: users[0].name,
        project_role: project_role || 'Member',
      },
    });
  } catch (error) {
    console.error('addMember ERROR:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to add member',
    });
  }
};

export const updateMemberRole = async (req, res, next) => {
  try {
    const { project_role } = req.body;

    const [existing] = await pool.execute(
      'SELECT pm.id, pm.project_role FROM project_members pm WHERE pm.project_id = ? AND pm.user_id = ?',
      [req.params.id, req.params.userId],
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Member not found in this project' });
    }

    await pool.execute(
      'UPDATE project_members SET project_role = ? WHERE project_id = ? AND user_id = ?',
      [project_role || null, req.params.id, req.params.userId],
    );

    await logActivity(req.user.id, 'update_member_role', 'project', req.params.id, { project_role: existing[0].project_role }, { project_role }, req.ip);

    return res.status(200).json({ success: true, message: 'Member role updated' });
  } catch (err) {
    next(err);
  }
};

export const removeMember = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const [existing] = await pool.execute(
      'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?',
      [req.params.id, userId],
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Member not found in this project' });
    }

    await pool.execute(
      'DELETE FROM project_members WHERE project_id = ? AND user_id = ?',
      [req.params.id, userId],
    );

    await pool.execute(
      'UPDATE tasks SET assigned_to = NULL WHERE project_id = ? AND assigned_to = ?',
      [req.params.id, userId],
    );

    await logActivity(req.user.id, 'remove_member', 'project', req.params.id, { user_id: userId }, null, req.ip);

    return res.status(200).json({ success: true, message: 'Member removed from project' });
  } catch (err) {
    next(err);
  }
};

export const getRecycleBin = async (req, res, next) => {
  try {
    const [projects] = await pool.execute(
      `SELECT p.id, p.name, p.deleted_at, u.name as deleted_by_name
       FROM projects p
       LEFT JOIN users u ON p.deleted_by = u.id
       WHERE p.deleted_at IS NOT NULL
       ORDER BY p.deleted_at DESC`
    );

    return res.status(200).json({ success: true, data: projects });
  } catch (err) {
    next(err);
  }
};

export const restoreProject = async (req, res, next) => {
  try {
    const [existing] = await pool.execute('SELECT id, name FROM projects WHERE id = ? AND deleted_at IS NOT NULL', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found in recycle bin' });
    }

    await pool.execute('UPDATE projects SET deleted_at = NULL, deleted_by = NULL WHERE id = ?', [req.params.id]);

    await logActivity(req.user.id, 'restore_project', 'project', req.params.id, null, { name: existing[0].name }, req.ip);

    return res.status(200).json({ success: true, message: 'Project restored successfully' });
  } catch (err) {
    next(err);
  }
};

export const permanentDeleteProject = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [existing] = await connection.execute('SELECT id, name FROM projects WHERE id = ? AND deleted_at IS NOT NULL', [req.params.id]);
    if (existing.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Project not found in recycle bin' });
    }

    await connection.execute('DELETE FROM requirements WHERE project_id = ?', [req.params.id]);
    await connection.execute('DELETE FROM milestones WHERE project_id = ?', [req.params.id]);
    await connection.execute('DELETE FROM tasks WHERE project_id = ?', [req.params.id]);
    await connection.execute('DELETE FROM project_members WHERE project_id = ?', [req.params.id]);
    
    await connection.execute('DELETE FROM projects WHERE id = ?', [req.params.id]);

    await logActivity(req.user.id, 'delete_project_permanent', 'project', req.params.id, { name: existing[0].name }, null, req.ip);

    await connection.commit();
    return res.status(200).json({ success: true, message: 'Project permanently deleted' });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
};
