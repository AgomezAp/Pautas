import { Request, Response, NextFunction } from 'express';
import { usersService } from './users.service';
import { sendSuccess, sendCreated, sendError } from '../../../utils/response.util';

export class UsersController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await usersService.list(req.query);
      return sendSuccess(res, result.data, result.meta);
    } catch (err) { next(err); }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await usersService.getById(parseInt(req.params.id));
      return sendSuccess(res, user);
    } catch (err: any) {
      if (err.status) return sendError(res, err.code, err.message, err.status);
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await usersService.create(req.body, req.user!.sub, req.ip);
      return sendCreated(res, user);
    } catch (err: any) {
      if (err.status) return sendError(res, err.code, err.message, err.status);
      if (err.code === '23505') return sendError(res, 'DUPLICATE', 'El usuario o email ya existe', 409);
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await usersService.update(parseInt(req.params.id), req.body, req.user!.sub, req.ip);
      return sendSuccess(res, user);
    } catch (err: any) {
      if (err.status) return sendError(res, err.code, err.message, err.status);
      next(err);
    }
  }

  async toggleActive(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await usersService.toggleActive(parseInt(req.params.id), req.user!.sub, req.ip);
      return sendSuccess(res, result);
    } catch (err: any) {
      if (err.status) return sendError(res, err.code, err.message, err.status);
      next(err);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await usersService.softDelete(parseInt(req.params.id), req.user!.sub, req.ip);
      return sendSuccess(res, result);
    } catch (err: any) {
      if (err.status) return sendError(res, err.code, err.message, err.status);
      next(err);
    }
  }

  async getPautadorAccounts(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = parseInt(req.params.id);
      const accounts = await usersService.getPautadorAccounts(userId);
      return sendSuccess(res, accounts);
    } catch (err) { next(err); }
  }

  async setPautadorAccounts(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = parseInt(req.params.id);
      const { account_ids } = req.body;
      if (!Array.isArray(account_ids)) {
        return res.status(400).json({ status: 'error', message: 'account_ids must be an array' });
      }
      await usersService.setPautadorAccounts(userId, account_ids);
      return sendSuccess(res, { message: 'Cuentas asignadas correctamente' });
    } catch (err) { next(err); }
  }

  async getAllGoogleAdsAccounts(req: Request, res: Response, next: NextFunction) {
    try {
      const accounts = await usersService.getAllGoogleAdsAccounts();
      return sendSuccess(res, accounts);
    } catch (err) { next(err); }
  }
}

export const usersController = new UsersController();
