import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/authMiddleware.js';
import {
  createAnnouncement,
  getAllAnnouncements,
  pinAnnouncement,
  deleteAnnouncement,
} from '../controllers/announcementController.js';

const router = Router();

router.post('/', verifyToken, requireRole('super_admin', 'manager'), createAnnouncement);
router.get('/', verifyToken, getAllAnnouncements);
router.patch('/:id/pin', verifyToken, requireRole('super_admin', 'manager'), pinAnnouncement);
router.delete('/:id', verifyToken, requireRole('super_admin', 'manager'), deleteAnnouncement);

export default router;
