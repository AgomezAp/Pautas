import { Request, Response, NextFunction } from 'express';
import { contabilidadService } from './contabilidad.service';
import { sendSuccess, sendError } from '../../utils/response.util';

export class ContabilidadController {
  async getKpis(req: Request, res: Response, next: NextFunction) {
    try {
      const { country_id, date_from, date_to } = req.query as Record<string, string>;
      const kpis = await contabilidadService.getKpis({
        countryId: country_id ? parseInt(country_id) : undefined,
        dateFrom: date_from,
        dateTo: date_to,
      });
      return sendSuccess(res, kpis);
    } catch (err) { next(err); }
  }

  async getCierres(req: Request, res: Response, next: NextFunction) {
    try {
      const { country_id, date_from, date_to, user_id, approval_status, page, limit } = req.query as Record<string, string>;
      const result = await contabilidadService.getCierres({
        countryId: country_id ? parseInt(country_id) : undefined,
        dateFrom: date_from,
        dateTo: date_to,
        userId: user_id ? parseInt(user_id) : undefined,
        approvalStatus: approval_status as any,
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 20,
      });
      return sendSuccess(res, result.data, result.meta);
    } catch (err) { next(err); }
  }

  async getVouchers(req: Request, res: Response, next: NextFunction) {
    try {
      const entryId = parseInt(req.params['entryId']);
      const vouchers = await contabilidadService.getVouchers(entryId);
      return sendSuccess(res, vouchers);
    } catch (err) { next(err); }
  }

  async reviewVoucher(req: Request, res: Response, next: NextFunction) {
    try {
      const voucherId = parseInt(req.params['voucherId']);
      const { is_approved, comment } = req.body;
      if (typeof is_approved !== 'boolean' && is_approved !== 'true' && is_approved !== 'false') {
        return sendError(res, 'VALIDATION_ERROR', 'is_approved debe ser true o false', 400);
      }
      const voucher = await contabilidadService.reviewVoucher({
        voucherId,
        reviewerId: req.user!.sub,
        isApproved: is_approved === true || is_approved === 'true',
        comment,
      });
      return sendSuccess(res, voucher);
    } catch (err: any) {
      if (err.status) return sendError(res, err.code, err.message, err.status);
      next(err);
    }
  }
}

export const contabilidadController = new ContabilidadController();
