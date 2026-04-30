import { Router } from 'express';
import { notificationsController } from './notifications.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/',          (req, res, next) => notificationsController.getAll(req, res, next));
router.get('/unread',    (req, res, next) => notificationsController.getUnreadCount(req, res, next));
router.patch('/read-all', (req, res, next) => notificationsController.markAllAsRead(req, res, next));
router.patch('/:id/read', (req, res, next) => notificationsController.markAsRead(req, res, next));

export { router as notificationsRoutes };
