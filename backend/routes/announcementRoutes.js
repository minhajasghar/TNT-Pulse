import { Router } from 'express';
import { verifyToken, requireRole, checkPermission } from '../middleware/authMiddleware.js';
import {
  createAnnouncement,
  getAllAnnouncements,
  pinAnnouncement,
  deleteAnnouncement,
} from '../controllers/announcementController.js';

const router = Router();

router.post('/', verifyToken, checkPermission('announcements', 'create'), createAnnouncement);
router.get('/', verifyToken, getAllAnnouncements);
router.patch('/:id/pin', verifyToken, checkPermission('announcements', 'edit'), pinAnnouncement);
router.delete('/:id', verifyToken, checkPermission('announcements', 'delete'), deleteAnnouncement);

export default router;
