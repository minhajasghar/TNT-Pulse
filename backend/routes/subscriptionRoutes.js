import express from 'express';
import { verifyToken, requireRole } from '../middleware/authMiddleware.js';
import {
  createSubscription,
  getAllSubscriptions,
  getSubscriptionById,
  updateSubscription,
  deleteSubscription,
  linkProject,
  unlinkProject,
  getProjectSubscriptions,
  getExpiringStats,
  getSubscriptionsByProject
} from '../controllers/subscriptionController.js';

const router = express.Router();

// GET /api/subscriptions/stats
router.get('/stats', verifyToken, getExpiringStats);

// GET /api/subscriptions/by-project
router.get('/by-project', verifyToken, getSubscriptionsByProject);

// GET /api/subscriptions/project/:project_id
router.get('/project/:project_id', verifyToken, getProjectSubscriptions);

// POST /api/subscriptions
router.post('/', verifyToken, requireRole('super_admin', 'manager'), createSubscription);

// GET /api/subscriptions
router.get('/', verifyToken, getAllSubscriptions);

// GET /api/subscriptions/:id
router.get('/:id', verifyToken, getSubscriptionById);

// PUT /api/subscriptions/:id
router.put('/:id', verifyToken, requireRole('super_admin', 'manager'), updateSubscription);

// DELETE /api/subscriptions/:id
router.delete('/:id', verifyToken, requireRole('super_admin'), deleteSubscription);

// POST /api/subscriptions/:id/projects
router.post('/:id/projects', verifyToken, requireRole('super_admin', 'manager'), linkProject);

// DELETE /api/subscriptions/:id/projects/:projectId
router.delete('/:id/projects/:projectId', verifyToken, requireRole('super_admin', 'manager'), unlinkProject);

export default router;
