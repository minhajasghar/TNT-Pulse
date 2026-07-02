import { Router } from 'express';
import { verifyToken, requireRole, checkPermission } from '../middleware/authMiddleware.js';
import {
  getAllUsers,
  getUserById,
  updateUser,
  updatePermissions,
  suspendUser,
  reactivateUser,
  transferSuperAdmin,
  deleteUser,
  getMyPermissions,
  getUserPermissions,
} from '../controllers/userController.js';

const router = Router();

router.get('/', verifyToken, checkPermission('team', 'view'), getAllUsers);
router.get('/me/permissions', verifyToken, getMyPermissions);
router.get('/:id', verifyToken, getUserById);
router.put('/:id', verifyToken, updateUser);
router.get('/:id/permissions', verifyToken, getUserPermissions);
router.put('/:id/permissions', verifyToken, requireRole('super_admin'), updatePermissions);
router.patch('/:id/suspend', verifyToken, checkPermission('team', 'edit'), suspendUser);
router.patch('/:id/reactivate', verifyToken, checkPermission('team', 'edit'), reactivateUser);
router.delete('/:id', verifyToken, checkPermission('team', 'delete'), deleteUser);
router.post('/transfer-admin', verifyToken, requireRole('super_admin'), transferSuperAdmin);

export default router;
