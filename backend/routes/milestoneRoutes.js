import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/authMiddleware.js';
import {
  createMilestone,
  getMilestonesByProject,
  updateMilestone,
  deleteMilestone,
} from '../controllers/milestoneController.js';

const router = Router();

router.post('/', verifyToken, requireRole('super_admin', 'manager'), createMilestone);
router.get('/project/:project_id', verifyToken, getMilestonesByProject);
router.put('/:id', verifyToken, requireRole('super_admin', 'manager'), updateMilestone);
router.delete('/:id', verifyToken, requireRole('super_admin', 'manager'), deleteMilestone);

export default router;
