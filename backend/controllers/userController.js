import bcrypt from 'bcrypt';
import pool from '../config/db.js';

const logActivity = async (userId, action, entityType, entityId, oldValue, newValue, ipAddress) => {
  await pool.execute(
    'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, old_value, new_value, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [userId, action, entityType, entityId, oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null, ipAddress],
  );
};

export const getAllUsers = async (req, res, next) => {
  try {
    let query = 'SELECT id, name, email, role, status, last_seen, created_by, created_at, updated_at FROM users WHERE 1=1';
    const params = [];

    if (req.query.role) {
      query += ' AND role = ?';
      params.push(req.query.role);
    }

    if (req.query.status) {
      query += ' AND status = ?';
      params.push(req.query.status);
    }

    query += ' ORDER BY created_at DESC';

    const [rows] = await pool.execute(query, params);

    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

export const getUserById = async (req, res, next) => {
  try {
    const [users] = await pool.execute(
      'SELECT id, name, email, role, status, last_seen, created_by, created_at, updated_at FROM users WHERE id = ?',
      [req.params.id],
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const [activeProjects] = await pool.execute(
      `SELECT COUNT(DISTINCT pm.project_id) AS count
       FROM project_members pm
       JOIN projects p ON p.id = pm.project_id
       WHERE pm.user_id = ? AND p.status NOT IN ('completed', 'on_hold')`,
      [req.params.id],
    );

    const [activeTasks] = await pool.execute(
      "SELECT COUNT(*) AS count FROM tasks WHERE assigned_to = ? AND status != 'done'",
      [req.params.id],
    );

    const [completedTasks] = await pool.execute(
      "SELECT COUNT(*) AS count FROM tasks WHERE assigned_to = ? AND status = 'done'",
      [req.params.id],
    );

    const [overdueTasks] = await pool.execute(
      "SELECT COUNT(*) AS count FROM tasks WHERE assigned_to = ? AND due_date < CURDATE() AND status != 'done'",
      [req.params.id],
    );

    const [projects] = await pool.execute(
      `SELECT p.id, p.name, p.status,
              (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND assigned_to = ?) AS task_count
       FROM projects p
       JOIN project_members pm ON pm.project_id = p.id
       WHERE pm.user_id = ?
       ORDER BY p.name ASC`,
      [req.params.id, req.params.id],
    );

    return res.status(200).json({
      success: true,
      data: {
        ...users[0],
        active_projects: activeProjects[0].count,
        active_tasks: activeTasks[0].count,
        completed_tasks: completedTasks[0].count,
        overdue_tasks: overdueTasks[0].count,
        total_projects: projects.length,
        projects,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const targetId = parseInt(req.params.id);
    const currentUserId = parseInt(req.user.id);
    const isSelf = targetId === currentUserId;
    const isAdmin = req.user.role === 'super_admin';
    const isManager = req.user.role === 'manager';

    // Permission rules:
    // 1. User can update their OWN profile (name, email, password)
    // 2. Only super_admin can update someone else's role or status
    // 3. Nobody can update super_admin except themselves

    if (!isSelf && !isAdmin && !isManager) {
      return res.status(403).json({ success: false, message: 'You can only update your own profile' });
    }

    if (!isSelf && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }

    const [existing] = await pool.execute(
      'SELECT id, name, email, password_hash, role, status FROM users WHERE id = ?',
      [targetId],
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = existing[0];

    if (user.role === 'super_admin' && !isSelf) {
      return res.status(403).json({ success: false, message: 'Cannot modify Super Admin account' });
    }

    // Build allowed fields
    const updates = {};
    const changes = [];

    // Self can always update name and email
    if (isSelf) {
      if (req.body.name !== undefined) {
        updates.name = req.body.name;
        changes.push({ field: 'name', old: user.name, new: req.body.name });
      }
      if (req.body.email !== undefined) {
        updates.email = req.body.email;
        changes.push({ field: 'email', old: user.email, new: req.body.email });
      }
    }

    // Only admin can update role and status of others
    if (isAdmin) {
      if (req.body.role !== undefined) {
        if (isSelf) {
          return res.status(403).json({ success: false, message: 'Cannot update your own role' });
        }
        updates.role = req.body.role;
        changes.push({ field: 'role', old: user.role, new: req.body.role });
      }
      if (req.body.status !== undefined) {
        updates.status = req.body.status;
        changes.push({ field: 'status', old: user.status, new: req.body.status });
      }
    }

    // Handle password separately
    let passwordChanged = false;
    if (req.body.password !== undefined) {
      if (req.body.password.length < 8) {
        return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
      }

      // If email is also being changed, the password is for confirmation only
      if (req.body.email !== undefined && req.body.email !== user.email) {
        const isMatch = await bcrypt.compare(req.body.password, user.password_hash);
        if (!isMatch) {
          return res.status(403).json({ success: false, message: 'Current password is incorrect' });
        }
      } else {
        // Only changing password — hash and store it
        const hash = await bcrypt.hash(req.body.password, 12);
        updates.password_hash = hash;
        passwordChanged = true;
        changes.push({ field: 'password', old: null, new: 'changed' });
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    // Build dynamic query
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = fields.map((f) => `${f} = ?`).join(', ');

    await pool.execute(
      `UPDATE users SET ${setClause} WHERE id = ?`,
      [...values, targetId],
    );

    // Log activity
    const oldData = {};
    const newData = {};
    for (const change of changes) {
      oldData[change.field] = change.old;
      newData[change.field] = change.new;
    }

    try {
      await logActivity(req.user.id, 'update_user', 'user', targetId, oldData, newData, req.ip);
    } catch (logErr) {
      console.error('Activity log failed for updateUser:', logErr.message);
    }

    const [updated] = await pool.execute(
      'SELECT id, name, email, role, status, last_seen, created_by, created_at, updated_at FROM users WHERE id = ?',
      [targetId],
    );

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: updated[0],
    });
  } catch (err) {
    console.error('updateUser ERROR:', err.message);
    next(err);
  }
};

export const updatePermissions = async (req, res) => {
  try {
    console.log('updatePermissions called');
    console.log('Target user:', req.params.id);
    console.log('Permissions:', req.body);

    const user_id = req.params.id;
    const { permissions } = req.body;

    if (!permissions || !Array.isArray(permissions)) {
      return res.status(400).json({
        success: false,
        message: 'permissions array required',
      });
    }

    // Clear existing permissions to avoid duplicates since ON DUPLICATE KEY UPDATE might not work if no unique constraint exists
    await pool.execute('DELETE FROM roles_permissions WHERE user_id = ?', [user_id]);

    // Insert each permission
    for (const perm of permissions) {
      await pool.execute(
        `INSERT INTO roles_permissions (user_id, module_name, can_view, can_create, can_edit, can_delete)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          user_id,
          perm.module_name,
          perm.can_view ? 1 : 0,
          perm.can_create ? 1 : 0,
          perm.can_edit ? 1 : 0,
          perm.can_delete ? 1 : 0,
        ],
      );
    }

    const [updated] = await pool.execute(
      'SELECT * FROM roles_permissions WHERE user_id = ?',
      [user_id],
    );

    console.log('Permissions saved:', updated.length, 'modules');

    return res.json({
      success: true,
      message: 'Permissions saved successfully',
      data: mapPermissions(updated),
    });
  } catch (error) {
    console.error('updatePermissions ERROR:', error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const suspendUser = async (req, res, next) => {
  try {
    if (parseInt(req.user.id) === parseInt(req.params.id)) {
      return res.status(400).json({ success: false, message: 'You cannot remove yourself' });
    }

    const [existing] = await pool.execute('SELECT id, name, role, status FROM users WHERE id = ?', [req.params.id]);

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (existing[0].role === 'super_admin') {
      return res.status(403).json({ success: false, message: 'Super Admin cannot be suspended or removed' });
    }

    if (existing[0].status === 'suspended') {
      return res.status(400).json({ success: false, message: 'User is already suspended' });
    }

    await pool.execute('UPDATE users SET status = ? WHERE id = ?', ['suspended', req.params.id]);

    await logActivity(
      req.user.id,
      'suspend_user',
      'user',
      req.params.id,
      { status: existing[0].status },
      { status: 'suspended' },
      req.ip,
    );

    return res.status(200).json({
      success: true,
      message: 'Member removed successfully',
    });
  } catch (err) {
    next(err);
  }
};

export const reactivateUser = async (req, res, next) => {
  try {
    if (parseInt(req.user.id) === parseInt(req.params.id)) {
      return res.status(400).json({ success: false, message: 'You cannot reactivate yourself' });
    }

    const [existing] = await pool.execute('SELECT id, name, role, status FROM users WHERE id = ?', [req.params.id]);

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (existing[0].role === 'super_admin') {
      return res.status(403).json({ success: false, message: 'Super Admin cannot be reactivated via this endpoint' });
    }

    if (existing[0].status === 'active') {
      return res.status(400).json({ success: false, message: 'User is already active' });
    }

    await pool.execute('UPDATE users SET status = ? WHERE id = ?', ['active', req.params.id]);

    await logActivity(
      req.user.id,
      'reactivate_user',
      'user',
      req.params.id,
      { status: existing[0].status },
      { status: 'active' },
      req.ip,
    );

    return res.status(200).json({
      success: true,
      message: 'Member reactivated successfully',
    });
  } catch (err) {
    next(err);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    if (parseInt(req.user.id) === parseInt(req.params.id)) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
    }

    const [existing] = await pool.execute('SELECT id, name, role, status FROM users WHERE id = ?', [req.params.id]);

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (existing[0].role === 'super_admin') {
      return res.status(403).json({ success: false, message: 'Super Admin cannot be deleted' });
    }

    await pool.execute('UPDATE tasks SET assigned_to = NULL WHERE assigned_to = ?', [req.params.id]);
    await pool.execute('DELETE FROM project_members WHERE user_id = ?', [req.params.id]);
    await pool.execute('DELETE FROM roles_permissions WHERE user_id = ?', [req.params.id]);
    await pool.execute('DELETE FROM notification_preferences WHERE user_id = ?', [req.params.id]);

    await logActivity(
      req.user.id,
      'user_deleted',
      'user',
      req.params.id,
      { name: existing[0].name, role: existing[0].role },
      null,
      req.ip,
    );

    await pool.execute('DELETE FROM users WHERE id = ?', [req.params.id]);

    return res.status(200).json({
      success: true,
      message: 'Member permanently removed',
    });
  } catch (err) {
    next(err);
  }
};

export const transferSuperAdmin = async (req, res, next) => {
  try {
    const { new_admin_id } = req.body;

    if (!new_admin_id) {
      return res.status(400).json({ success: false, message: 'new_admin_id is required' });
    }

    if (parseInt(req.user.id) === parseInt(new_admin_id)) {
      return res.status(400).json({ success: false, message: 'You are already the Super Admin' });
    }

    const [newAdmin] = await pool.execute(
      'SELECT id, name, role, status FROM users WHERE id = ?',
      [new_admin_id],
    );

    if (newAdmin.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (newAdmin[0].status !== 'active') {
      return res.status(400).json({ success: false, message: 'Target user must be active' });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      await connection.execute(
        'UPDATE users SET role = ? WHERE id = ?',
        ['manager', req.user.id],
      );

      await connection.execute(
        'UPDATE users SET role = ? WHERE id = ?',
        ['super_admin', new_admin_id],
      );

      await logActivity(
        req.user.id,
        'transfer_super_admin_out',
        'user',
        req.user.id,
        { role: 'super_admin' },
        { role: 'manager' },
        req.ip,
      );

      await logActivity(
        req.user.id,
        'transfer_super_admin_in',
        'user',
        new_admin_id,
        { role: newAdmin[0].role },
        { role: 'super_admin' },
        req.ip,
      );

      await connection.commit();
      connection.release();

      return res.status(200).json({
        success: true,
        message: 'Super Admin rights transferred successfully',
      });
    } catch (txErr) {
      await connection.rollback();
      connection.release();
      throw txErr;
    }
  } catch (err) {
    next(err);
  }
};

const mapPermissions = (rows) =>
  rows.map((r) => ({
    ...r,
    can_view: Boolean(r.can_view),
    can_create: Boolean(r.can_create),
    can_edit: Boolean(r.can_edit),
    can_delete: Boolean(r.can_delete),
  }));

export const getUserPermissions = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, user_id, module_name, can_view, can_create, can_edit, can_delete FROM roles_permissions WHERE user_id = ?',
      [req.params.id],
    );
    return res.status(200).json({ success: true, data: mapPermissions(rows) });
  } catch (err) {
    next(err);
  }
};

const DEFAULT_MODULES = ['projects', 'tasks', 'team', 'documents', 'reports', 'activity', 'announcements', 'subscriptions'];

export const getMyPermissions = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, module_name, can_view, can_create, can_edit, can_delete FROM roles_permissions WHERE user_id = ?',
      [req.user.id],
    );

    if (rows.length === 0) {
      const defaults = DEFAULT_MODULES.map((module_name) => ({
        module_name,
        can_view: true,
        can_create: false,
        can_edit: false,
        can_delete: false,
      }));
      return res.status(200).json({ success: true, data: defaults });
    }

    return res.status(200).json({ success: true, data: mapPermissions(rows) });
  } catch (err) {
    next(err);
  }
};
