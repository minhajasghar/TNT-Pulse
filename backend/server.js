import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import alertRoutes from './routes/alertRoutes.js';
import milestoneRoutes from './routes/milestoneRoutes.js';
import requirementRoutes from './routes/requirementRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import activityRoutes from './routes/activityRoutes.js';
import announcementRoutes from './routes/announcementRoutes.js';
import documentRoutes from './routes/documentRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import subscriptionRoutes from './routes/subscriptionRoutes.js';
import escalationRuleRoutes from './routes/escalationRuleRoutes.js';
import { initCronJobs } from './utils/cronJobs.js';
import { runMigrations } from './utils/migrate.js';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 5000;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
}));
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} | ${req.method} ${req.url}`);
  next();
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    project: 'TNT Pulse',
    timestamp: new Date(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/milestones', milestoneRoutes);
app.use('/api/requirements', requirementRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/escalation-rules', escalationRuleRoutes);

app.use((err, req, res, next) => {
  console.error('=== SERVER ERROR ===');
  console.error('Route:', req.method, req.url);
  console.error('Body:', req.body);
  console.error('Error:', err.message);
  console.error('Stack:', err.stack);
  console.error('===================');

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

async function ensureTables() {
  const tables = [
    `CREATE TABLE IF NOT EXISTS documents (
      id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      title       VARCHAR(255) NOT NULL,
      description TEXT DEFAULT NULL,
      file_name   VARCHAR(255) NOT NULL,
      file_path   VARCHAR(500) NOT NULL,
      file_size   INT UNSIGNED DEFAULT NULL,
      file_type   VARCHAR(50) DEFAULT NULL,
      project_id  INT UNSIGNED DEFAULT NULL,
      uploaded_by INT UNSIGNED DEFAULT NULL,
      uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_docs_project_id  FOREIGN KEY (project_id)  REFERENCES projects(id) ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT fk_docs_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES users(id)   ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS announcements (
      id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      title       VARCHAR(255) NOT NULL,
      content     TEXT NOT NULL,
      priority    ENUM('normal','important','urgent') NOT NULL DEFAULT 'normal',
      is_pinned   BOOLEAN NOT NULL DEFAULT FALSE,
      created_by  INT UNSIGNED DEFAULT NULL,
      created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_announcements_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ];
  for (const sql of tables) {
    try {
      await pool.execute(sql);
    } catch (err) {
      console.error('Table creation error:', err.message);
    }
  }
}

app.listen(PORT, async () => {
  console.log(`TNT Pulse backend running on port ${PORT}`);
  await ensureTables();
  try {
    await runMigrations();
  } catch (err) {
    console.error('Migration error:', err.message);
  }
  initCronJobs();
});
