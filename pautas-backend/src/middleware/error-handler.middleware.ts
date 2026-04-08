import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.util';
import { sendError } from '../utils/response.util';

function isDatabaseError(err: any): boolean {
  return (
    err.message?.includes('Connection terminated') ||
    err.message?.includes('connection timeout') ||
    err.message?.includes('ECONNREFUSED') ||
    err.message?.includes('ECONNRESET') ||
    err.message?.includes('ETIMEDOUT') ||
    err.message?.includes('EHOSTUNREACH') ||
    err.message?.includes('too many clients') ||
    err.message?.includes('remaining connection slots') ||
    err.code === '57P01' || // admin_shutdown
    err.code === '57P02' || // crash_shutdown
    err.code === '57P03' || // cannot_connect_now
    err.code === '08000' || // connection_exception
    err.code === '08003' || // connection_does_not_exist
    err.code === '08006' || // connection_failure
    err.code === '08001' || // sqlclient_unable_to_establish_sqlconnection
    err.code === 'ECONNREFUSED'
  );
}

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  logger.error(err.message, { stack: err.stack, code: err.code });

  // --- Errores de validación ---
  if (err.name === 'ValidationError') {
    return sendError(res, 'VALIDATION_ERROR', err.message, 400);
  }

  // --- Errores de autenticación ---
  if (err.name === 'UnauthorizedError' || err.status === 401) {
    return sendError(res, 'UNAUTHORIZED', 'Token inválido o expirado', 401);
  }

  // --- Errores de base de datos: conexión / timeout ---
  if (isDatabaseError(err)) {
    return sendError(res, 'DATABASE_CONNECTION_ERROR', 'Servicio temporalmente no disponible, intente nuevamente', 503);
  }

  // --- Errores de base de datos: query timeout ---
  if (err.code === '57014') { // query_canceled (statement_timeout)
    return sendError(res, 'QUERY_TIMEOUT', 'La consulta tardó demasiado tiempo, intente nuevamente', 504);
  }

  // --- Errores de base de datos: constraints ---
  if (err.code === '23505') {
    return sendError(res, 'DUPLICATE_ENTRY', 'El registro ya existe', 409);
  }

  if (err.code === '23503') {
    return sendError(res, 'FOREIGN_KEY_ERROR', 'Referencia a registro inexistente', 400);
  }

  if (err.code === '23502') { // not_null_violation
    return sendError(res, 'MISSING_REQUIRED_FIELD', 'Falta un campo obligatorio', 400);
  }

  if (err.code === '22001') { // string_data_right_truncation
    return sendError(res, 'DATA_TOO_LONG', 'Un campo excede la longitud máxima permitida', 400);
  }

  // --- Errores de payload ---
  if (err.type === 'entity.too.large') {
    return sendError(res, 'PAYLOAD_TOO_LARGE', 'El archivo excede el tamaño máximo permitido', 413);
  }

  if (err.type === 'entity.parse.failed') {
    return sendError(res, 'INVALID_JSON', 'El cuerpo de la solicitud no es JSON válido', 400);
  }

  // --- Error genérico ---
  return sendError(
    res,
    'INTERNAL_ERROR',
    process.env.NODE_ENV === 'production' ? 'Error interno del servidor' : err.message,
    500
  );
}
 