import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/authMiddleware.js';
import {
  getProjectReport,
  getTeamReport,
  getTaskReport,
} from '../controllers/reportController.js';

const router = Router();

router.get('/projects', verifyToken, requireRole('super_admin', 'manager'), getProjectReport);
router.get('/team', verifyToken, requireRole('super_admin', 'manager'), getTeamReport);
router.get('/tasks', verifyToken, requireRole('super_admin', 'manager'), getTaskReport);

export default router;
