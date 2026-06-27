import pool from '../config/db.js';
import { sendAnnouncementEmail } from '../utils/emailService.js';

const ensureTable = async () => {
  try {
    await pool.execute(`SELECT 1 FROM announcements LIMIT 1`);
  } catch {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS announcements (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        priority ENUM('normal','important','urgent') DEFAULT 'normal',
        is_pinned BOOLEAN DEFAULT false,
        created_by INT UNSIGNED DEFAULT NULL,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }
};

const logActivity = async (userId, action, entityType, entityId, oldValue, newValue, ipAddress) => {
  await pool.execute(
    'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, old_value, new_value, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [userId, action, entityType, entityId, oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null, ipAddress],
  );
};

export const createAnnouncement = async (req, res, next) => {
  try {
    await ensureTable();
    if (req.user.role !== 'super_admin' && req.user.role !== 'manager') {
      return res.status(403).json({ success: false, message: 'Only super_admin and manager can create announcements' });
    }

    const { title, content, priority } = req.body;

    if (!title || typeof title !== 'string' || title.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'Title is required and must be at least 3 characters' });
    }

    if (!content || typeof content !== 'string' || content.trim().length < 10) {
      return res.status(400).json({ success: false, message: 'Content is required and must be at least 10 characters' });
    }

    const validPriorities = ['normal', 'important', 'urgent'];
    if (!priority || !validPriorities.includes(priority)) {
      return res.status(400).json({ success: false, message: 'Priority must be normal, important, or urgent' });
    }

    const [result] = await pool.execute(
      'INSERT INTO announcements (title, content, priority, created_by) VALUES (?, ?, ?, ?)',
      [title.trim(), content.trim(), priority, req.user.id],
    );

    const announcementId = result.insertId;

    const [creatorRows] = await pool.execute(
      'SELECT name FROM users WHERE id = ?',
      [req.user.id],
    );
    const creatorName = creatorRows.length > 0 ? creatorRows[0].name : 'Unknown';

    const [activeUsers] = await pool.execute(
      'SELECT id, name, email FROM users WHERE status = ? AND id != ?',
      ['active', req.user.id],
    );

    const notifiedCount = activeUsers.length;

    if (activeUsers.length > 0) {
      await Promise.all(activeUsers.map((user) =>
        pool.execute(
          'INSERT INTO alerts (user_id, type, message, related_entity_type, related_entity_id) VALUES (?, ?, ?, ?, ?)',
          [user.id, 'new_announcement', `New announcement: ${title.trim()}`, 'announcement', announcementId],
        )
      ));

      Promise.all(activeUsers.map(async (user) => {
        try {
          const [prefRows] = await pool.execute(
            'SELECT email_enabled FROM notification_preferences WHERE user_id = ?',
            [user.id],
          );
          const emailEnabled = prefRows.length > 0 ? prefRows[0].email_enabled : true;
          if (emailEnabled) {
            await sendAnnouncementEmail({
              to: user.email,
              name: user.name,
              announcementTitle: title.trim(),
              announcementContent: content.trim(),
              priority,
              postedBy: creatorName,
            });
          }
        } catch (emailErr) {
          console.error(`Failed to send announcement email to ${user.email}: ${emailErr.message}`);
        }
      }));
    }

    await logActivity(
      req.user.id,
      'create_announcement',
      'announcement',
      announcementId,
      null,
      { title: title.trim(), priority, notified_users: notifiedCount },
      req.ip,
    );

    return res.status(201).json({
      success: true,
      message: `Announcement created and ${notifiedCount} users notified`,
      data: {
        id: announcementId,
        title: title.trim(),
        content: content.trim(),
        priority,
        is_pinned: false,
        created_by: req.user.id,
        creator_name: creatorName,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getAllAnnouncements = async (req, res, next) => {
  try {
    await ensureTable();
    let query = `SELECT a.*, u.name AS creator_name
                 FROM announcements a
                 LEFT JOIN users u ON u.id = a.created_by
                 WHERE 1=1`;
    const params = [];

    if (req.query.priority) {
      query += ' AND a.priority = ?';
      params.push(req.query.priority);
    }

    query += ' ORDER BY a.is_pinned DESC, a.created_at DESC';

    const [rows] = await pool.execute(query, params);

    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

export const pinAnnouncement = async (req, res, next) => {
  try {
    await ensureTable();
    const [existing] = await pool.execute('SELECT id, is_pinned FROM announcements WHERE id = ?', [req.params.id]);

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    const newPinned = !existing[0].is_pinned;

    await pool.execute('UPDATE announcements SET is_pinned = ? WHERE id = ?', [newPinned, req.params.id]);

    await logActivity(
      req.user.id,
      newPinned ? 'pin_announcement' : 'unpin_announcement',
      'announcement',
      req.params.id,
      { is_pinned: existing[0].is_pinned },
      { is_pinned: newPinned },
      req.ip,
    );

    const [updated] = await pool.execute(
      `SELECT a.*, u.name AS creator_name
       FROM announcements a
       LEFT JOIN users u ON u.id = a.created_by
       WHERE a.id = ?`,
      [req.params.id],
    );

    return res.status(200).json({ success: true, data: updated[0] });
  } catch (err) {
    next(err);
  }
};

export const deleteAnnouncement = async (req, res, next) => {
  try {
    await ensureTable();
    const [existing] = await pool.execute('SELECT id, title FROM announcements WHERE id = ?', [req.params.id]);

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    await pool.execute('DELETE FROM announcements WHERE id = ?', [req.params.id]);

    await logActivity(
      req.user.id,
      'delete_announcement',
      'announcement',
      req.params.id,
      { title: existing[0].title },
      null,
      req.ip,
    );

    return res.status(200).json({ success: true, message: 'Announcement deleted' });
  } catch (err) {
    next(err);
  }
};
