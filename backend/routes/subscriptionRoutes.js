import express from 'express';
import { verifyToken, requireRole, checkPermission } from '../middleware/authMiddleware.js';
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
  getSubscriptionsByProject,
  getUniqueEmails
} from '../controllers/subscriptionController.js';

const router = express.Router();

// GET /api/subscriptions/stats
router.get('/stats', verifyToken, getExpiringStats);

// GET /api/subscriptions/emails
router.get('/emails', verifyToken, getUniqueEmails);

// GET /api/subscriptions/by-project
router.get('/by-project', verifyToken, getSubscriptionsByProject);

// GET /api/subscriptions/project/:project_id
router.get('/project/:project_id', verifyToken, getProjectSubscriptions);

// POST /api/subscriptions
router.post('/', verifyToken, checkPermission('subscriptions', 'create'), createSubscription);

// GET /api/subscriptions
router.get('/', verifyToken, getAllSubscriptions);

// GET /api/subscriptions/:id
router.get('/:id', verifyToken, getSubscriptionById);

// PUT /api/subscriptions/:id
router.put('/:id', verifyToken, checkPermission('subscriptions', 'edit'), updateSubscription);

// DELETE /api/subscriptions/:id
router.delete('/:id', verifyToken, checkPermission('subscriptions', 'delete'), deleteSubscription);

// POST /api/subscriptions/:id/projects
router.post('/:id/projects', verifyToken, checkPermission('subscriptions', 'edit'), linkProject);

// DELETE /api/subscriptions/:id/projects/:projectId
router.delete('/:id/projects/:projectId', verifyToken, checkPermission('subscriptions', 'edit'), unlinkProject);

export default router;
