import pool from '../config/db.js';

const logActivity = async (userId, action, entityType, entityId, oldValue, newValue, ipAddress) => {
  await pool.execute(
    'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, old_value, new_value, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [Number(userId), action, entityType, Number(entityId), oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null, ipAddress],
  );
};

export const createRequirement = async (req, res, next) => {
  try {
    const project_id = Number(req.body.project_id);
    const { title, description, type } = req.body;

    if (!project_id || !title) {
      return res.status(400).json({ success: false, message: 'project_id and title are required' });
    }

    const validTypes = ['functional', 'technical', 'client_note'];
    if (type && !validTypes.includes(type)) {
      return res.status(400).json({ success: false, message: `type must be one of: ${validTypes.join(', ')}` });
    }

    const [project] = await pool.execute('SELECT id FROM projects WHERE id = ?', [project_id]);
    if (project.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const [result] = await pool.execute(
      'INSERT INTO requirements (project_id, title, description, type, created_by) VALUES (?, ?, ?, ?, ?)',
      [project_id, title, description || null, type || 'functional', Number(req.user.id)],
    );

    const [requirement] = await pool.execute('SELECT * FROM requirements WHERE id = ?', [Number(result.insertId)]);

    return res.status(201).json({ success: true, message: 'Requirement created', data: requirement[0] });
  } catch (err) {
    next(err);
  }
};

export const getRequirementsByProject = async (req, res, next) => {
  try {
    const [requirements] = await pool.execute(
      `SELECT r.*, u.name AS created_by_name
       FROM requirements r
       LEFT JOIN users u ON u.id = r.created_by
       WHERE r.project_id = ?
       ORDER BY r.created_at ASC`,
      [Number(req.params.project_id)],
    );

    const grouped = { functional: [], technical: [], client_note: [] };
    for (const reqt of requirements) {
      if (grouped[reqt.type]) {
        grouped[reqt.type].push(reqt);
      }
    }

    return res.status(200).json({ success: true, data: grouped });
  } catch (err) {
    next(err);
  }
};

export const updateRequirement = async (req, res, next) => {
  try {
    const requirementId = Number(req.params.id);
    const [existing] = await pool.execute('SELECT * FROM requirements WHERE id = ?', [requirementId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Requirement not found' });
    }

    const requirement = existing[0];
    const isManager = req.user.role === 'super_admin' || req.user.role === 'manager';
    const updates = {};
    const changes = [];

    const allFields = ['title', 'description', 'approval_status'];
    const userFields = ['title', 'description'];

    const allowedFields = isManager ? allFields : userFields;

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'approval_status') {
          const validStatuses = ['pending', 'approved', 'rejected'];
          if (!validStatuses.includes(req.body[field])) {
            return res.status(400).json({ success: false, message: `approval_status must be one of: ${validStatuses.join(', ')}` });
          }
        }
        updates[field] = req.body[field];
        changes.push({ field, old: requirement[field], new: req.body[field] });
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    const setClauses = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const updateValues = Object.values(updates);

    await pool.execute(`UPDATE requirements SET ${setClauses} WHERE id = ?`, [...updateValues, requirementId]);

    const oldData = {};
    const newData = {};
    for (const change of changes) {
      oldData[change.field] = change.old;
      newData[change.field] = change.new;
    }

    await logActivity(req.user.id, 'update_requirement', 'requirement', requirementId, oldData, newData, req.ip);

    const [updated] = await pool.execute('SELECT * FROM requirements WHERE id = ?', [requirementId]);

    return res.status(200).json({ success: true, message: 'Requirement updated', data: updated[0] });
  } catch (err) {
    next(err);
  }
};

export const deleteRequirement = async (req, res, next) => {
  try {
    const requirementId = Number(req.params.id);
    const [existing] = await pool.execute('SELECT id, title FROM requirements WHERE id = ?', [requirementId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Requirement not found' });
    }

    await pool.execute('DELETE FROM requirements WHERE id = ?', [requirementId]);

    return res.status(200).json({ success: true, message: 'Requirement deleted' });
  } catch (err) {
    next(err);
  }
};
