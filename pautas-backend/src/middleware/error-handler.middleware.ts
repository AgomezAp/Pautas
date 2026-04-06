import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.util';
import { sendError } from '../utils/response.util';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  logger.error(err.message, { stack: err.stack });

  if (err.name === 'ValidationError') {
    return sendError(res, 'VALIDATION_ERROR', err.message, 400);
  }

  if (err.name === 'UnauthorizedError' || err.status === 401) {
    return sendError(res, 'UNAUTHORIZED', 'Token inválido o expirado', 401);
  }

  if (err.code === '23505') {
    return sendError(res, 'DUPLICATE_ENTRY', 'El registro ya existe', 409);
  }

  if (err.code === '23503') {
    return sendError(res, 'FOREIGN_KEY_ERROR', 'Referencia a registro inexistente', 400);
  }

  if (err.type === 'entity.too.large') {
    return sendError(res, 'PAYLOAD_TOO_LARGE', 'El archivo excede el tamaño máximo permitido', 413);
  }

  return sendError(
    res,
    'INTERNAL_ERROR',
    process.env.NODE_ENV === 'production' ? 'Error interno del servidor' : err.message,
    500
  );
}
 