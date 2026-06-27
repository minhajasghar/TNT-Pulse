import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/authMiddleware.js';
import {
  getAdminDashboard,
  getMemberDashboard,
  getProjectDashboard,
} from '../controllers/dashboardController.js';

const router = Router();

router.get('/admin', verifyToken, requireRole('super_admin', 'manager'), getAdminDashboard);
router.get('/member', verifyToken, getMemberDashboard);
router.get('/project/:id', verifyToken, getProjectDashboard);

export default router;
