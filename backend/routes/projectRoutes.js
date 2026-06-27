import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/authMiddleware.js';
import {
  createProject,
  getAllProjects,
  getProjectById,
  updateProject,
  deleteProject,
  addMember,
  updateMemberRole,
  removeMember,
  getRecycleBin,
  restoreProject,
  permanentDeleteProject
} from '../controllers/projectController.js';

const router = Router();

router.post('/', verifyToken, createProject);
router.get('/', verifyToken, getAllProjects);
router.get('/recycle-bin', verifyToken, requireRole('super_admin', 'manager'), getRecycleBin);
router.get('/:id', verifyToken, getProjectById);
router.put('/:id', verifyToken, updateProject);
router.delete('/:id', verifyToken, requireRole('super_admin', 'manager'), deleteProject);
router.post('/:id/members', verifyToken, requireRole('super_admin', 'manager'), addMember);
router.patch('/:id/members/:userId/role', verifyToken, requireRole('super_admin', 'manager'), updateMemberRole);
router.delete('/:id/members/:userId', verifyToken, requireRole('super_admin', 'manager'), removeMember);
router.patch('/:id/restore', verifyToken, requireRole('super_admin', 'manager'), restoreProject);
router.delete('/:id/permanent', verifyToken, requireRole('super_admin'), permanentDeleteProject);

export default router;
