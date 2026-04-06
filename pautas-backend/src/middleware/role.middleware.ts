import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response.util';

export function roleMiddleware(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, 'UNAUTHORIZED', 'Autenticación requerida', 401);
    }

    if (!allowedRoles.includes(req.user.role)) {
      return sendError(res, 'FORBIDDEN', 'No tiene permisos para acceder a este recurso', 403);
    }

    next();
  };
}
