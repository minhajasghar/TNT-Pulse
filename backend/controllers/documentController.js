import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pool from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.resolve(__dirname, '..', 'uploads');

const logActivity = async (userId, action, entityType, entityId, oldValue, newValue, ipAddress) => {
  await pool.execute(
    'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, old_value, new_value, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [userId, action, entityType, entityId, oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null, ipAddress],
  );
};

export const uploadDocument = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { title, description, project_id } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase().replace('.', '');
    const fileSize = req.file.size;
    const fileName = req.file.filename;
    const filePath = req.file.path;

    const [result] = await pool.execute(
      'INSERT INTO documents (title, description, file_name, file_path, file_size, file_type, project_id, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [title.trim(), description?.trim() || null, fileName, filePath, fileSize, ext, project_id || null, req.user.id],
    );

    try {
      await logActivity(
        req.user.id,
        'upload_document',
        'document',
        result.insertId,
        null,
        { title: title.trim(), file_type: ext, file_size: fileSize },
        req.ip,
      );
    } catch (logErr) {
      console.error('Failed to log document upload activity:', logErr.message);
    }

    const [doc] = await pool.execute(
      `SELECT d.*, u.name AS uploader_name
       FROM documents d
       LEFT JOIN users u ON u.id = d.uploaded_by
       WHERE d.id = ?`,
      [result.insertId],
    );

    return res.status(201).json({ success: true, message: 'Document uploaded', data: doc[0] });
  } catch (err) {
    next(err);
  }
};

export const getAllDocuments = async (req, res, next) => {
  try {
    const { project_id, type } = req.query;

    let query = `SELECT d.*, u.name AS uploader_name
                 FROM documents d
                 LEFT JOIN users u ON u.id = d.uploaded_by
                 WHERE 1=1`;
    const params = [];

    if (project_id) {
      query += ' AND d.project_id = ?';
      params.push(project_id);
    }

    if (type) {
      query += ' AND d.file_type = ?';
      params.push(type);
    }

    const isAdmin = req.user.role === 'super_admin' || req.user.role === 'manager';

    if (!project_id && !isAdmin) {
      query += ` AND (d.project_id IS NULL
                  OR d.project_id IN (
                    SELECT pm.project_id FROM project_members pm WHERE pm.user_id = ?
                  ))`;
      params.push(req.user.id);
    }

    if (req.query.search) {
      query += ' AND d.title LIKE CONCAT("%", ?, "%")';
      params.push(req.query.search);
    }

    query += ' ORDER BY d.uploaded_at DESC';

    const [rows] = await pool.execute(query, params);

    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

export const deleteDocument = async (req, res, next) => {
  try {
    const [existing] = await pool.execute(
      'SELECT * FROM documents WHERE id = ?',
      [req.params.id],
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    const doc = existing[0];
    const isSuperAdmin = req.user.role === 'super_admin';
    const isOwner = Number(doc.uploaded_by) === Number(req.user.id);

    if (!isSuperAdmin && !isOwner) {
      return res.status(403).json({ success: false, message: 'Only the uploader or super_admin can delete this document' });
    }

    const filePath = doc.file_path;
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await pool.execute('DELETE FROM documents WHERE id = ?', [req.params.id]);

    try {
      await logActivity(
        req.user.id,
        'delete_document',
        'document',
        req.params.id,
        { title: doc.title, file_name: doc.file_name },
        null,
        req.ip,
      );
    } catch (logErr) {
      console.error('Failed to log document delete activity:', logErr.message);
    }

    return res.status(200).json({ success: true, message: 'Document deleted' });
  } catch (err) {
    next(err);
  }
};

export const downloadDocument = async (req, res, next) => {
  try {
    const [existing] = await pool.execute(
      'SELECT * FROM documents WHERE id = ?',
      [req.params.id],
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    const doc = existing[0];
    const filePath = doc.file_path;

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'File not found on server' });
    }

    const originalName = doc.file_name;
    const ext = path.extname(originalName);
    const downloadName = `${doc.title}${ext}`;

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadName)}"`);
    res.setHeader('Content-Type', 'application/octet-stream');

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (err) {
    next(err);
  }
};
