import { Router } from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import {
  getMyAlerts,
  markAsRead,
  markAllAsRead,
  deleteAlert,
  getUnreadCount,
} from '../controllers/alertController.js';

const router = Router();

router.get('/', verifyToken, getMyAlerts);
router.get('/unread-count', verifyToken, getUnreadCount);
router.put('/mark-read', verifyToken, markAsRead);
router.put('/mark-all-read', verifyToken, markAllAsRead);
router.delete('/:id', verifyToken, deleteAlert);

export default router;
