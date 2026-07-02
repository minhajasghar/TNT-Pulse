import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

export const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied: insufficient role' });
    }

    next();
  };
};

export const checkPermission = (module, action) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    if (req.user.role === 'super_admin' || req.user.role === 'manager') {
      return next();
    }

    try {
      const [rows] = await pool.execute(
        `SELECT can_view, can_create, can_edit, can_delete
         FROM roles_permissions
         WHERE user_id = ? AND module_name = ?
         LIMIT 1`,
        [req.user.id, module],
      );

      if (rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: `Permission denied for ${module}:${action}`,
        });
      }

      const permission = rows[0];
      const columnMap = { view: 'can_view', create: 'can_create', edit: 'can_edit', delete: 'can_delete' };
      const column = columnMap[action];

      if (!column || !permission[column]) {
        return res.status(403).json({
          success: false,
          message: `Permission denied for ${module}:${action}`,
        });
      }

      next();
    } catch (err) {
      console.error(`Permission check failed: ${err.message}`);
      return res.status(500).json({ success: false, message: 'Permission check failed' });
    }
  };
};
