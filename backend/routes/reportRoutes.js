import { Router } from 'express';
import { verifyToken, requireRole, checkPermission } from '../middleware/authMiddleware.js';
import {
  getProjectReport,
  getTeamReport,
  getTaskReport,
} from '../controllers/reportController.js';

const router = Router();

router.get('/projects', verifyToken, checkPermission('reports', 'view'), getProjectReport);
router.get('/team', verifyToken, checkPermission('reports', 'view'), getTeamReport);
router.get('/tasks', verifyToken, checkPermission('reports', 'view'), getTaskReport);

export default router;
