import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/authMiddleware.js';
import { registerUser, loginUser, getMe } from '../controllers/authController.js';

const router = Router();

router.post('/register', verifyToken, requireRole('super_admin'), registerUser);
router.post('/login', loginUser);
router.get('/me', verifyToken, getMe);

export default router;
