import { Request, Response, NextFunction } from 'express';
import { campaignReportsService } from './campaign-reports.service';
import { sendSuccess, sendCreated, sendError } from '../../utils/response.util';
import { query } from '../../config/database';

export class CampaignReportsController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { campaign_id, description } = req.body;
      if (!campaign_id || !description?.trim()) {
        return sendError(res, 'VALIDATION_ERROR', 'campaign_id y description son requeridos', 400);
      }
      const report = await campaignReportsService.createReport({
        pautadorId: req.user!.sub,
        campaignId: parseInt(campaign_id),
        description: description.trim(),
        pautadorName: req.user!.username || 'Pautador',
      });
      return sendCreated(res, report);
    } catch (err: any) {
      if (err.statusCode === 404) return sendError(res, 'NOT_FOUND', err.message, 404);
      next(err);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const role = req.user!.role;
      let countryIds: number[] | undefined;

      if (role === 'gestion_administrativa') {
        // Get all countries assigned to this user
        const countryResult = await query(
          `SELECT country_id FROM user_countries WHERE user_id = $1
           UNION
           SELECT country_id FROM users WHERE id = $1 AND country_id IS NOT NULL`,
          [req.user!.sub]
        );
        countryIds = countryResult.rows.map((r: any) => r.country_id);
      }

      const result = await campaignReportsService.getReports({
        role,
        userId: req.user!.sub,
        countryIds,
        campaignId: req.query['campaign_id'] ? parseInt(req.query['campaign_id'] as string) : undefined,
        page: req.query['page'] ? parseInt(req.query['page'] as string) : 1,
        limit: req.query['limit'] ? parseInt(req.query['limit'] as string) : 20,
      });
      return sendSuccess(res, result.data, result.meta);
    } catch (err) { next(err); }
  }

  async getCampaigns(req: Request, res: Response, next: NextFunction) {
    try {
      const campaigns = await campaignReportsService.getCampaignsForPautador(req.user!.sub);
      return sendSuccess(res, campaigns);
    } catch (err) { next(err); }
  }
}

export const campaignReportsController = new CampaignReportsController();
