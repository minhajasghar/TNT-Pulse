import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/authMiddleware.js';
import {
  createRequirement,
  getRequirementsByProject,
  updateRequirement,
  deleteRequirement,
} from '../controllers/requirementController.js';

const router = Router();

router.post('/', verifyToken, createRequirement);
router.get('/project/:project_id', verifyToken, getRequirementsByProject);
router.put('/:id', verifyToken, updateRequirement);
router.delete('/:id', verifyToken, requireRole('super_admin', 'manager'), deleteRequirement);

export default router;
