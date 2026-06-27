import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/authMiddleware.js';
import {
  createTask,
  getTasksByProject,
  getMyTasks,
  updateTask,
  deleteTask,
  addComment,
  getTaskComments,
} from '../controllers/taskController.js';

const router = Router();

router.post('/', verifyToken, createTask);
router.get('/my', verifyToken, getMyTasks);
router.get('/project/:project_id', verifyToken, getTasksByProject);
router.put('/:id', verifyToken, updateTask);
router.delete('/:id', verifyToken, requireRole('super_admin', 'manager'), deleteTask);
router.post('/:id/comments', verifyToken, addComment);
router.get('/:id/comments', verifyToken, getTaskComments);

export default router;
