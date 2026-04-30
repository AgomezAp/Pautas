import { Request, Response, NextFunction } from 'express';
import { notificationsService } from './notifications.service';
import { sendSuccess, sendError } from '../../utils/response.util';

export class NotificationsController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const notifications = await notificationsService.getNotifications(req.user!.sub);
      return sendSuccess(res, notifications);
    } catch (err) { next(err); }
  }

  async getUnreadCount(req: Request, res: Response, next: NextFunction) {
    try {
      const count = await notificationsService.getUnreadCount(req.user!.sub);
      return sendSuccess(res, { count });
    } catch (err) { next(err); }
  }

  async markAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params['id']);
      const notification = await notificationsService.markAsRead(req.user!.sub, id);
      if (!notification) return sendError(res, 'NOT_FOUND', 'Notificación no encontrada', 404);
      return sendSuccess(res, notification);
    } catch (err) { next(err); }
  }

  async markAllAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      await notificationsService.markAllAsRead(req.user!.sub);
      return sendSuccess(res, { message: 'Todas marcadas como leídas' });
    } catch (err) { next(err); }
  }
}

export const notificationsController = new NotificationsController();
