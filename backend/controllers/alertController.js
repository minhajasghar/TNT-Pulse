import pool from '../config/db.js';

export const getMyAlerts = async (req, res, next) => {
  try {
    let query = 'SELECT * FROM alerts WHERE user_id = ?';
    const params = [req.user.id];

    if (req.query.is_read !== undefined) {
      query += ' AND is_read = ?';
      params.push(req.query.is_read === 'true' ? 1 : 0);
    }

    query += ' ORDER BY created_at DESC';

    const [alerts] = await pool.execute(query, params);

    const [countResult] = await pool.execute(
      'SELECT COUNT(*) AS unread_count FROM alerts WHERE user_id = ? AND is_read = FALSE',
      [req.user.id],
    );

    return res.status(200).json({
      success: true,
      data: {
        alerts,
        unread_count: countResult[0].unread_count,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const markAsRead = async (req, res, next) => {
  try {
    const { alert_ids } = req.body;

    if (!Array.isArray(alert_ids) || alert_ids.length === 0) {
      return res.status(400).json({ success: false, message: 'alert_ids array is required' });
    }

    const placeholders = alert_ids.map(() => '?').join(', ');
    const [result] = await pool.execute(
      `UPDATE alerts SET is_read = TRUE WHERE id IN (${placeholders}) AND user_id = ?`,
      [...alert_ids, req.user.id],
    );

    return res.status(200).json({
      success: true,
      message: `${result.affectedRows} alerts marked as read`,
    });
  } catch (err) {
    next(err);
  }
};

export const markAllAsRead = async (req, res, next) => {
  try {
    await pool.execute(
      'UPDATE alerts SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE',
      [req.user.id],
    );

    return res.status(200).json({ success: true, message: 'All alerts marked as read' });
  } catch (err) {
    next(err);
  }
};

export const deleteAlert = async (req, res, next) => {
  try {
    const alertId = Number(req.params.id);
    const [existing] = await pool.execute(
      'SELECT id FROM alerts WHERE id = ? AND user_id = ?',
      [alertId, Number(req.user.id)],
    );

    if (existing.length === 0) {
      return res.status(403).json({ success: false, message: 'Alert not found or access denied' });
    }

    await pool.execute('DELETE FROM alerts WHERE id = ?', [alertId]);

    return res.status(200).json({ success: true, message: 'Alert deleted' });
  } catch (err) {
    next(err);
  }
};

export const getUnreadCount = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) AS count FROM alerts WHERE user_id = ? AND is_read = FALSE',
      [req.user.id],
    );

    return res.status(200).json({ success: true, data: { count: rows[0].count } });
  } catch (err) {
    next(err);
  }
};
