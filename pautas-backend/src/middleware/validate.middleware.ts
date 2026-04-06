import { validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response.util';

export function validate(req: Request, res: Response, next: NextFunction) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const details = errors.array().map((err: any) => ({
      field: err.path,
      message: err.msg,
    }));
    return sendError(res, 'VALIDATION_ERROR', 'Datos inválidos', 400, details);
  }
  next();
}
