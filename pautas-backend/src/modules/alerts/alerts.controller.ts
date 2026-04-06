import { Request, Response, NextFunction } from 'express';
import { alertsService } from './alerts.service';
import { sendSuccess, sendError } from '../../utils/response.util';

export class AlertsController {
  async getAlerts(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await alertsService.getAlerts(
        req.query,
        req.user!.role,
        req.user!.countryId
      );
      return sendSuccess(res, result.data, result.meta);
    } catch (err) { next(err); }
  }

  async getSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await alertsService.getSummary(req.user!.role, req.user!.countryId);
      return sendSuccess(res, result);
    } catch (err) { next(err); }
  }

  async getTrend(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await alertsService.getTrend(req.user!.role, req.user!.countryId);
      return sendSuccess(res, result);
    } catch (err) { next(err); }
  }

  async getTopAlerted(req: Request, res: Response, next: NextFunction) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const result = await alertsService.getTopAlerted(req.user!.role, req.user!.countryId, limit);
      return sendSuccess(res, result);
    } catch (err) { next(err); }
  }

  async acknowledge(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await alertsService.acknowledge(parseInt(req.params.id), req.user!.sub);
      return sendSuccess(res, result);
    } catch (err: any) {
      if (err.status) return sendError(res, err.code, err.message, err.status);
      next(err);
    }
  }

  async resolve(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await alertsService.resolve(parseInt(req.params.id), req.user!.sub);
      return sendSuccess(res, result);
    } catch (err: any) {
      if (err.status) return sendError(res, err.code, err.message, err.status);
      next(err);
    }
  }

  async dismiss(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await alertsService.dismiss(parseInt(req.params.id), req.user!.sub);
      return sendSuccess(res, result);
    } catch (err: any) {
      if (err.status) return sendError(res, err.code, err.message, err.status);
      next(err);
    }
  }

  async getThresholds(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await alertsService.getThresholds();
      return sendSuccess(res, result);
    } catch (err) { next(err); }
  }

  async upsertThreshold(req: Request, res: Response, next: NextFunction) {
    try {
      const { alert_type, country_id, campaign_id, threshold_value, is_active } = req.body;
      const result = await alertsService.upsertThreshold({
        alert_type,
        country_id: country_id || null,
        campaign_id: campaign_id || null,
        threshold_value,
        is_active: is_active !== false,
        updated_by: req.user!.sub,
      });
      return sendSuccess(res, result);
    } catch (err: any) {
      if (err.status) return sendError(res, err.code, err.message, err.status);
      next(err);
    }
  }

  async getRanking(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await alertsService.getRanking(req.query);
      return sendSuccess(res, result);
    } catch (err) { next(err); }
  }

  async getAdsComparison(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await alertsService.getAdsVsFieldComparison(req.query);
      return sendSuccess(res, result);
    } catch (err) { next(err); }
  }
}

export const alertsController = new AlertsController();
