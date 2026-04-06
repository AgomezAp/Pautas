import { Response } from 'express';

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function sendSuccess(res: Response, data: any, meta?: PaginationMeta, statusCode = 200) {
  const response: any = { success: true, data };
  if (meta) response.meta = meta;
  return res.status(statusCode).json(response);
}

export function sendError(
  res: Response,
  code: string,
  message: string,
  statusCode = 400,
  details?: any[]
) {
  const error: any = { code, message };
  if (details) error.details = details;
  return res.status(statusCode).json({ success: false, error });
}

export function sendCreated(res: Response, data: any) {
  return sendSuccess(res, data, undefined, 201);
}

export function sendNoContent(res: Response) {
  return res.status(204).send();
}
