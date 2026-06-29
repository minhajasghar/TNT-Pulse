import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pool from '../config/db.js';
import { sendWelcomeEmail } from '../utils/emailService.js';

export const registerUser = async (req, res, next) => {
  try {
    const { name, email, password: providedPassword, role } = req.body;

    if (!name || !email || !role) {
      return res.status(400).json({ success: false, message: 'Name, email, and role are required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }

    const password = providedPassword && providedPassword.length >= 8
      ? providedPassword
      : crypto.randomBytes(4).toString('hex');

    if (role.length < 1) {
      return res.status(400).json({ success: false, message: 'Role is required' });
    }

    const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const [result] = await pool.execute(
      'INSERT INTO users (name, email, password_hash, role, created_by) VALUES (?, ?, ?, ?, ?)',
      [name, email, passwordHash, role, req.user.id],
    );

    await pool.execute(
      'INSERT INTO notification_preferences (user_id, email_enabled, in_app_enabled, alert_days_before_deadline) VALUES (?, TRUE, TRUE, 3)',
      [result.insertId],
    );

    sendWelcomeEmail({
      to: email,
      name,
      role,
      temporaryPassword: password,
    });

    return res.status(201).json({
      success: true,
      message: 'User created successfully. Login credentials sent via email.',
      data: { id: result.insertId, name, email, role },
    });
  } catch (err) {
    next(err);
  }
};

export const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const [rows] = await pool.execute('SELECT id, name, email, password_hash, role, status FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const user = rows[0];

    if (user.status === 'suspended') {
      return res.status(403).json({ success: false, message: 'Account suspended. Contact admin.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    await pool.execute('UPDATE users SET last_seen = NOW() WHERE id = ?', [user.id]);

    const [permissions] = await pool.execute(
      'SELECT module_name, can_view, can_create, can_edit, can_delete FROM roles_permissions WHERE user_id = ?',
      [user.id],
    );

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
    );

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        permissions,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getMe = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, name, email, role, status, created_by, last_seen, created_at, updated_at FROM users WHERE id = ?',
      [req.user.id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};
