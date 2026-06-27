import pool from '../config/db.js';

const logActivity = async (userId, action, entityType, entityId, oldValue, newValue, ipAddress) => {
  await pool.execute(
    'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, old_value, new_value, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [userId, action, entityType, entityId, oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null, ipAddress],
  );
};

export const createProject = async (req, res, next) => {
  try {
    const { name, description, client_name, start_date, deadline, priority } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Project name is required' });
    }

    const [result] = await pool.execute(
      'INSERT INTO projects (name, description, client_name, start_date, deadline, priority, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, description || null, client_name || null, start_date || null, deadline || null, priority || 'medium', req.user.id],
    );

    await logActivity(req.user.id, 'create_project', 'project', result.insertId, null, { name }, req.ip);

    const [project] = await pool.execute('SELECT * FROM projects WHERE id = ?', [result.insertId]);

    return res.status(201).json({ success: true, message: 'Project created', data: project[0] });
  } catch (err) {
    next(err);
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
    const [projects] = await pool.execute(
      `SELECT p.*,
              (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) AS member_count,
              (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) AS total_tasks,
              (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'done') AS completed_tasks,
              (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status != 'done') AS active_tasks,
              u.name AS created_by_name
       FROM projects p
       LEFT JOIN users u ON u.id = p.created_by
       WHERE p.id = ? AND p.deleted_at IS NULL`,
      [req.params.id],
    );

    if (projects.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const [members] = await pool.execute(
      `SELECT u.id, u.name, u.email, u.role, u.status, pm.assigned_at,
              (SELECT COUNT(*) FROM tasks t WHERE t.project_id = pm.project_id AND t.assigned_to = u.id) as task_count,
              (SELECT COUNT(*) FROM tasks t WHERE t.project_id = pm.project_id AND t.assigned_to = u.id AND t.status = 'done') as completed_tasks,
              (SELECT COUNT(*) FROM tasks t WHERE t.project_id = pm.project_id AND t.assigned_to = u.id AND t.status != 'done' AND t.deadline < NOW()) as overdue_tasks
       FROM project_members pm
       JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = ?
       ORDER BY pm.assigned_at ASC`,
      [req.params.id],
    );

    const membersWithStats = members.map(m => {
        const initials = m.name ? m.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U';
        const completion_rate = m.task_count > 0 ? Math.round((m.completed_tasks / m.task_count) * 100) : 0;
        return { ...m, initials, completion_rate };
    });

    return res.status(200).json({
      success: true,
      data: {
        ...projects[0],
        members: membersWithStats,
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

export const addMember = async (req, res, next) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ success: false, message: 'user_id is required' });
    }

    const [project] = await pool.execute('SELECT id FROM projects WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
    if (project.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const [user] = await pool.execute('SELECT id FROM users WHERE id = ? AND status = ?', [user_id, 'active']);
    if (user.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found or not active' });
    }

    const [existing] = await pool.execute(
      'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?',
      [req.params.id, user_id],
    );

    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'User is already a member of this project' });
    }

    await pool.execute(
      'INSERT INTO project_members (project_id, user_id) VALUES (?, ?)',
      [req.params.id, user_id],
    );

    await logActivity(req.user.id, 'add_member', 'project', req.params.id, null, { user_id }, req.ip);

    return res.status(201).json({ success: true, message: 'Member added to project' });
  } catch (err) {
    next(err);
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

    // Delete related entities first due to foreign keys
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
