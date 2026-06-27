import pool from '../config/db.js';

export const getActivityLogs = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (req.query.user_id) {
      whereClause += ' AND al.user_id = ?';
      params.push(req.query.user_id);
    }

    if (req.query.entity_type) {
      whereClause += ' AND al.entity_type = ?';
      params.push(req.query.entity_type);
    }

    if (req.query.entity_id) {
      whereClause += ' AND al.entity_id = ?';
      params.push(req.query.entity_id);
    }

    if (req.query.from) {
      whereClause += ' AND al.created_at >= ?';
      params.push(req.query.from);
    }

    if (req.query.to) {
      whereClause += ' AND al.created_at <= ?';
      params.push(`${req.query.to} 23:59:59`);
    }

    const countParams = [...params];
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) AS total FROM activity_logs al ${whereClause}`,
      countParams,
    );
    const totalCount = countResult[0].total;

    const [logs] = await pool.execute(
      `SELECT al.*, u.name AS user_name
       FROM activity_logs al
       LEFT JOIN users u ON u.id = al.user_id
       ${whereClause}
       ORDER BY al.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, String(limit), String(offset)],
    );

    return res.status(200).json({
      success: true,
      data: {
        logs,
        total_count: totalCount,
        current_page: page,
        total_pages: Math.ceil(totalCount / limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getProjectActivity = async (req, res, next) => {
  try {
    const projectId = req.params.id;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const [countResult] = await pool.execute(
      `SELECT COUNT(*) AS total FROM activity_logs
       WHERE (entity_type = 'project' AND entity_id = ?)
          OR (entity_type = 'task' AND entity_id IN (SELECT id FROM tasks WHERE project_id = ?))
          OR (entity_type = 'milestone' AND entity_id IN (SELECT id FROM milestones WHERE project_id = ?))
          OR (entity_type = 'requirement' AND entity_id IN (SELECT id FROM requirements WHERE project_id = ?))`,
      [projectId, projectId, projectId, projectId],
    );
    const totalCount = countResult[0].total;

    const [logs] = await pool.execute(
      `SELECT al.*, u.name AS user_name
       FROM activity_logs al
       LEFT JOIN users u ON u.id = al.user_id
       WHERE (al.entity_type = 'project' AND al.entity_id = ?)
          OR (al.entity_type = 'task' AND al.entity_id IN (SELECT id FROM tasks WHERE project_id = ?))
          OR (al.entity_type = 'milestone' AND al.entity_id IN (SELECT id FROM milestones WHERE project_id = ?))
          OR (al.entity_type = 'requirement' AND al.entity_id IN (SELECT id FROM requirements WHERE project_id = ?))
       ORDER BY al.created_at DESC
       LIMIT ? OFFSET ?`,
      [projectId, projectId, projectId, projectId, String(limit), String(offset)],
    );

    return res.status(200).json({
      success: true,
      data: {
        logs,
        total_count: totalCount,
        current_page: page,
        total_pages: Math.ceil(totalCount / limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

export const exportActivityLogs = async (req, res, next) => {
  try {
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (req.query.from) {
      whereClause += ' AND al.created_at >= ?';
      params.push(req.query.from);
    }

    if (req.query.to) {
      whereClause += ' AND al.created_at <= ?';
      params.push(`${req.query.to} 23:59:59`);
    }

    const [logs] = await pool.execute(
      `SELECT al.*, u.name AS user_name
       FROM activity_logs al
       LEFT JOIN users u ON u.id = al.user_id
       ${whereClause}
       ORDER BY al.created_at DESC`,
      params,
    );

    const headers = 'Date,User,Action,Entity Type,Entity ID,Old Value,New Value,IP Address';
    const rows = logs.map(log => {
      const escapeCsv = (val) => {
        if (val === null || val === undefined) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      return [
        escapeCsv(log.created_at),
        escapeCsv(log.user_name || 'System'),
        escapeCsv(log.action),
        escapeCsv(log.entity_type),
        escapeCsv(log.entity_id),
        escapeCsv(log.old_value),
        escapeCsv(log.new_value),
        escapeCsv(log.ip_address),
      ].join(',');
    });

    const csv = `${headers}\n${rows.join('\n')}`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=activity_logs.csv');
    return res.status(200).send(csv);
  } catch (err) {
    next(err);
  }
};

export const globalSearch = async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();

    if (q.length < 2) {
      return res.status(400).json({ success: false, message: 'Search query must be at least 2 characters' });
    }

    const [projects, tasks, users, requirements] = await Promise.all([
      pool.execute(
        `SELECT id, name, status, 'name' AS match_field
         FROM projects
         WHERE name LIKE CONCAT('%', ?, '%')
            OR description LIKE CONCAT('%', ?, '%')
            OR client_name LIKE CONCAT('%', ?, '%')
         LIMIT 5`,
        [q, q, q],
      ),
      pool.execute(
        `SELECT t.id, t.title, t.status, p.name AS project_name
         FROM tasks t
         JOIN projects p ON p.id = t.project_id
         WHERE t.title LIKE CONCAT('%', ?, '%')
            OR t.description LIKE CONCAT('%', ?, '%')
         LIMIT 5`,
        [q, q],
      ),
      pool.execute(
        `SELECT id, name, email, role
         FROM users
         WHERE name LIKE CONCAT('%', ?, '%')
            OR email LIKE CONCAT('%', ?, '%')
         LIMIT 5`,
        [q, q],
      ),
      pool.execute(
        `SELECT r.id, r.title, r.type, p.name AS project_name
         FROM requirements r
         JOIN projects p ON p.id = r.project_id
         WHERE r.title LIKE CONCAT('%', ?, '%')
            OR r.description LIKE CONCAT('%', ?, '%')
         LIMIT 5`,
        [q, q],
      ),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        projects: projects[0],
        tasks: tasks[0],
        users: users[0],
        requirements: requirements[0],
      },
    });
  } catch (err) {
    next(err);
  }
};
