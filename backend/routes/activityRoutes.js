import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/authMiddleware.js';
import {
  getActivityLogs,
  getProjectActivity,
  exportActivityLogs,
  globalSearch,
} from '../controllers/activityController.js';

const router = Router();

router.get('/', verifyToken, requireRole('super_admin', 'manager'), getActivityLogs);
router.get('/search', verifyToken, globalSearch);
router.get('/export', verifyToken, requireRole('super_admin'), exportActivityLogs);
router.get('/project/:id', verifyToken, getProjectActivity);

export default router;
