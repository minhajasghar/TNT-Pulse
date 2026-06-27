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
import { initCronJobs } from './utils/cronJobs.js';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 5000;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
}));
app.use(express.json());

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

app.use((err, req, res, next) => {
  console.error(`Unhandled error: ${err.message}`);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

app.listen(PORT, () => {
  console.log(`TNT Pulse backend running on port ${PORT}`);
  initCronJobs();
});
