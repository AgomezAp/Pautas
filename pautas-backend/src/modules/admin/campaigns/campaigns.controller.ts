import { Request, Response, NextFunction } from 'express';
import { campaignsService } from './campaigns.service';
import { sendSuccess, sendCreated, sendError } from '../../../utils/response.util';

export class CampaignsController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await campaignsService.list(req.query);
      return sendSuccess(res, result.data, result.meta);
    } catch (err) { next(err); }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const campaign = await campaignsService.getById(parseInt(req.params.id));
      return sendSuccess(res, campaign);
    } catch (err: any) {
      if (err.status) return sendError(res, err.code, err.message, err.status);
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const campaign = await campaignsService.create(req.body, req.user!.sub, req.ip);
      return sendCreated(res, campaign);
    } catch (err: any) {
      if (err.status) return sendError(res, err.code, err.message, err.status);
      if (err.code === '23505') return sendError(res, 'DUPLICATE', 'La campaña ya existe para ese país', 409);
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const campaign = await campaignsService.update(parseInt(req.params.id), req.body, req.user!.sub, req.ip);
      return sendSuccess(res, campaign);
    } catch (err: any) {
      if (err.status) return sendError(res, err.code, err.message, err.status);
      next(err);
    }
  }
}

export const campaignsController = new CampaignsController();
