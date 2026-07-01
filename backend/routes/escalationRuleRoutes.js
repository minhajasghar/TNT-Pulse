import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/authMiddleware.js';
import {
  getAllRules,
  createRule,
  updateRule,
  deleteRule,
  toggleRule
} from '../controllers/escalationRuleController.js';

const router = Router();

router.get('/', verifyToken, requireRole('super_admin', 'manager'), getAllRules);
router.post('/', verifyToken, requireRole('super_admin'), createRule);
router.put('/:id', verifyToken, requireRole('super_admin'), updateRule);
router.delete('/:id', verifyToken, requireRole('super_admin'), deleteRule);
router.patch('/:id/toggle', verifyToken, requireRole('super_admin'), toggleRule);

export default router;
