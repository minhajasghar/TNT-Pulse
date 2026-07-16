import pool from '../config/db.js';

const logActivity = async (userId, action, entityType, entityId, oldValue, newValue, ipAddress) => {
  await pool.execute(
    'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, old_value, new_value, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [Number(userId), action, entityType, Number(entityId), oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null, ipAddress],
  );
};

export const createMilestone = async (req, res, next) => {
  try {
    const project_id = Number(req.body.project_id);
    const { title, due_date } = req.body;

    if (!project_id || !title) {
      return res.status(400).json({ success: false, message: 'project_id and title are required' });
    }

    const [project] = await pool.execute('SELECT id FROM projects WHERE id = ?', [project_id]);
    if (project.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const [result] = await pool.execute(
      'INSERT INTO milestones (project_id, title, due_date) VALUES (?, ?, ?)',
      [project_id, title, due_date || null],
    );

    const [milestone] = await pool.execute('SELECT * FROM milestones WHERE id = ?', [Number(result.insertId)]);

    return res.status(201).json({ success: true, message: 'Milestone created', data: milestone[0] });
  } catch (err) {
    next(err);
  }
};

export const getMilestonesByProject = async (req, res, next) => {
  try {
    const [milestones] = await pool.execute(
      `SELECT *, DATEDIFF(due_date, CURDATE()) AS days_remaining
       FROM milestones
       WHERE project_id = ?
       ORDER BY due_date ASC`,
      [Number(req.params.project_id)],
    );

    const enriched = milestones.map(m => ({
      ...m,
      overdue: m.due_date && new Date(m.due_date) < new Date(new Date().toDateString()) && m.status !== 'completed',
    }));

    return res.status(200).json({ success: true, data: enriched });
  } catch (err) {
    next(err);
  }
};

export const updateMilestone = async (req, res, next) => {
  try {
    const milestoneId = Number(req.params.id);
    const [existing] = await pool.execute('SELECT * FROM milestones WHERE id = ?', [milestoneId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Milestone not found' });
    }

    const milestone = existing[0];
    const updates = {};
    const changes = [];

    for (const field of ['title', 'due_date', 'status']) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
        changes.push({ field, old: milestone[field], new: req.body[field] });
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    if (updates.status === 'completed') {
      updates.completed_at = new Date();
    }

    const setClauses = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const updateValues = Object.values(updates);

    await pool.execute(`UPDATE milestones SET ${setClauses} WHERE id = ?`, [...updateValues, milestoneId]);

    const oldData = {};
    const newData = {};
    for (const change of changes) {
      oldData[change.field] = change.old;
      newData[change.field] = change.new;
    }

    await logActivity(req.user.id, 'update_milestone', 'milestone', milestoneId, oldData, newData, req.ip);

    const [updated] = await pool.execute('SELECT * FROM milestones WHERE id = ?', [milestoneId]);

    return res.status(200).json({ success: true, message: 'Milestone updated', data: updated[0] });
  } catch (err) {
    next(err);
  }
};

export const deleteMilestone = async (req, res, next) => {
  try {
    const milestoneId = Number(req.params.id);
    const [existing] = await pool.execute('SELECT id, title FROM milestones WHERE id = ?', [milestoneId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Milestone not found' });
    }

    await pool.execute('DELETE FROM milestones WHERE id = ?', [milestoneId]);

    return res.status(200).json({ success: true, message: 'Milestone deleted' });
  } catch (err) {
    next(err);
  }
};
