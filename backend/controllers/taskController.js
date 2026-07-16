import pool from '../config/db.js';

const logActivity = async (userId, action, entityType, entityId, oldValue, newValue, ipAddress) => {
  await pool.execute(
    'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, old_value, new_value, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [Number(userId), action, entityType, Number(entityId), oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null, ipAddress],
  );
};

const createAlert = async (userId, type, message, entityType, entityId) => {
  await pool.execute(
    'INSERT INTO alerts (user_id, type, message, related_entity_type, related_entity_id) VALUES (?, ?, ?, ?, ?)',
    [Number(userId), type, message, entityType, Number(entityId)],
  );
};

export const createTask = async (req, res, next) => {
  try {
    const project_id = Number(req.body.project_id);
    const { title, description } = req.body;
    const assigned_to = req.body.assigned_to ? Number(req.body.assigned_to) : null;
    const { due_date, priority, estimated_hours } = req.body;

    if (!project_id || !title) {
      return res.status(400).json({ success: false, message: 'project_id and title are required' });
    }

    const [project] = await pool.execute('SELECT id, name FROM projects WHERE id = ?', [project_id]);
    if (project.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    if (assigned_to) {
      const [member] = await pool.execute(
        'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?',
        [project_id, assigned_to],
      );
      if (member.length === 0) {
        return res.status(400).json({ success: false, message: 'Assigned user is not a member of this project' });
      }
    }

    const [result] = await pool.execute(
      `INSERT INTO tasks (project_id, title, description, assigned_to, created_by, priority, estimated_hours, due_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [project_id, title, description || null, assigned_to || null, Number(req.user.id), priority || 'medium', estimated_hours || null, due_date || null],
    );

    if (assigned_to) {
      await createAlert(assigned_to, 'task_assigned', `You have been assigned a new task: ${title}`, 'task', result.insertId);
    }

    await logActivity(req.user.id, 'create_task', 'task', result.insertId, null, { title, project_id }, req.ip);

    const [task] = await pool.execute(
      `SELECT t.*, u.name AS assigned_user_name
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assigned_to
       WHERE t.id = ?`,
      [result.insertId],
    );

    return res.status(201).json({ success: true, message: 'Task created successfully', data: task[0] });
  } catch (err) {
    next(err);
  }
};

export const getTasksByProject = async (req, res, next) => {
  try {
    const project_id = Number(req.params.project_id);
    let query = `
      SELECT t.*, u.name AS assigned_user_name,
             DATEDIFF(t.due_date, CURDATE()) AS days_remaining
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assigned_to
      WHERE t.project_id = ?
    `;
    const params = [project_id];

    if (req.query.status) {
      query += ' AND t.status = ?';
      params.push(req.query.status);
    }

    if (req.query.assigned_to) {
      query += ' AND t.assigned_to = ?';
      params.push(req.query.assigned_to);
    }

    if (req.query.priority) {
      query += ' AND t.priority = ?';
      params.push(req.query.priority);
    }

    query += ' ORDER BY t.created_at DESC';

    const [tasks] = await pool.execute(query, params);

    const enriched = tasks.map(task => ({
      ...task,
      overdue: task.due_date && new Date(task.due_date) < new Date(new Date().toDateString()) && task.status !== 'done',
    }));

    const grouped = { todo: [], in_progress: [], blocked: [], done: [] };
    for (const task of enriched) {
      if (grouped[task.status]) {
        grouped[task.status].push(task);
      }
    }

    return res.status(200).json({ success: true, data: grouped });
  } catch (err) {
    next(err);
  }
};

export const getMyTasks = async (req, res, next) => {
  try {
    const [tasks] = await pool.execute(
      `SELECT t.*, p.name AS project_name, u.name AS assigned_user_name,
              DATEDIFF(t.due_date, CURDATE()) AS days_remaining
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       LEFT JOIN users u ON u.id = t.assigned_to
       WHERE t.assigned_to = ?
       ORDER BY t.due_date ASC`,
      [Number(req.user.id)],
    );

    const enriched = tasks.map(task => ({
      ...task,
      overdue: task.due_date && new Date(task.due_date) < new Date(new Date().toDateString()) && task.status !== 'done',
    }));

    return res.status(200).json({ success: true, data: enriched });
  } catch (err) {
    next(err);
  }
};

export const updateTask = async (req, res, next) => {
  try {
    const taskId = Number(req.params.id);
    const [existing] = await pool.execute('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const task = existing[0];
    const isAssignee = parseInt(req.user.id) === parseInt(task.assigned_to);
    const isManager = req.user.role === 'super_admin' || req.user.role === 'manager';
    const updatableFields = isManager
      ? ['title', 'description', 'assigned_to', 'status', 'priority', 'estimated_hours', 'due_date', 'blocked_reason']
      : ['status', 'blocked_reason'];

    if (!isAssignee && !isManager) {
      return res.status(403).json({ success: false, message: 'You cannot update this task' });
    }

    const updates = {};
    for (const field of updatableFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    if (updates.status === 'blocked' && !updates.blocked_reason && !task.blocked_reason) {
      return res.status(400).json({ success: false, message: 'blocked_reason is required when status is blocked' });
    }

    const oldStatus = task.status;
    const newStatus = updates.status;

    if (newStatus === 'done') {
      updates.completed_at = new Date();
    }

    const setClauses = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const updateValues = Object.values(updates);

    await pool.execute(`UPDATE tasks SET ${setClauses} WHERE id = ?`, [...updateValues, taskId]);

    if (newStatus && newStatus !== oldStatus) {
      await logActivity(req.user.id, 'update_task_status', 'task', taskId, { status: oldStatus }, { status: newStatus }, req.ip);
    }

    const [updated] = await pool.execute(
      `SELECT t.*, u.name AS assigned_user_name
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assigned_to
       WHERE t.id = ?`,
      [taskId],
    );

    return res.status(200).json({ success: true, message: 'Task updated successfully', data: updated[0] });
  } catch (err) {
    next(err);
  }
};

export const deleteTask = async (req, res, next) => {
  try {
    const taskId = Number(req.params.id);
    const [existing] = await pool.execute('SELECT id, title FROM tasks WHERE id = ?', [taskId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    await pool.execute('DELETE FROM tasks WHERE id = ?', [taskId]);

    await logActivity(req.user.id, 'delete_task', 'task', taskId, { title: existing[0].title }, null, req.ip);

    return res.status(200).json({ success: true, message: 'Task deleted successfully' });
  } catch (err) {
    next(err);
  }
};

export const addComment = async (req, res, next) => {
  try {
    const { content } = req.body;
    const taskId = Number(req.params.id);

    if (!content) {
      return res.status(400).json({ success: false, message: 'Content is required' });
    }

    const [task] = await pool.execute(
      'SELECT t.id, t.title, t.assigned_to, t.project_id FROM tasks t WHERE t.id = ?',
      [taskId],
    );

    if (task.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const [member] = await pool.execute(
      'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?',
      [task[0].project_id, Number(req.user.id)],
    );

    if (member.length === 0) {
      return res.status(403).json({ success: false, message: 'You are not a member of this project' });
    }

    const [result] = await pool.execute(
      'INSERT INTO comments (entity_type, entity_id, user_id, content) VALUES (?, ?, ?, ?)',
      ['task', taskId, Number(req.user.id), content],
    );

    if (task[0].assigned_to && parseInt(task[0].assigned_to) !== parseInt(req.user.id)) {
      await createAlert(
        task[0].assigned_to,
        'new_comment',
        `New comment on task "${task[0].title}"`,
        'task',
        taskId,
      );
    }

    const [comment] = await pool.execute(
      `SELECT c.id, c.content, c.created_at, u.name AS user_name
       FROM comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.id = ?`,
      [result.insertId],
    );

    return res.status(201).json({ success: true, message: 'Comment added', data: comment[0] });
  } catch (err) {
    next(err);
  }
};

export const getTaskComments = async (req, res, next) => {
  try {
    const taskId = Number(req.params.id);
    const [comments] = await pool.execute(
      `SELECT c.id, c.content, c.created_at, u.name AS user_name
       FROM comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.entity_type = 'task' AND c.entity_id = ?
       ORDER BY c.created_at ASC`,
      [taskId],
    );

    return res.status(200).json({ success: true, data: comments });
  } catch (err) {
    next(err);
  }
};
