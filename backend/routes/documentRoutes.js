import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/authMiddleware.js';
import upload from '../config/multer.js';
import {
  uploadDocument,
  getAllDocuments,
  deleteDocument,
  downloadDocument,
} from '../controllers/documentController.js';

const router = Router();

router.post('/upload', verifyToken, upload.single('file'), uploadDocument);
router.get('/', verifyToken, getAllDocuments);
router.delete('/:id', verifyToken, deleteDocument);
router.get('/:id/download', verifyToken, downloadDocument);

export default router;
