import { Request, Response, NextFunction } from 'express';
import { countriesService } from './countries.service';
import { sendSuccess, sendCreated, sendError } from '../../../utils/response.util';

export class CountriesController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const countries = await countriesService.list(req.query.active === 'true');
      return sendSuccess(res, countries);
    } catch (err) { next(err); }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const country = await countriesService.getById(parseInt(req.params.id));
      return sendSuccess(res, country);
    } catch (err: any) {
      if (err.status) return sendError(res, err.code, err.message, err.status);
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const country = await countriesService.create(req.body, req.user!.sub, req.ip);
      return sendCreated(res, country);
    } catch (err: any) {
      if (err.status) return sendError(res, err.code, err.message, err.status);
      if (err.code === '23505') return sendError(res, 'DUPLICATE', 'El país ya existe', 409);
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const country = await countriesService.update(parseInt(req.params.id), req.body, req.user!.sub, req.ip);
      return sendSuccess(res, country);
    } catch (err: any) {
      if (err.status) return sendError(res, err.code, err.message, err.status);
      next(err);
    }
  }
}

export const countriesController = new CountriesController();
