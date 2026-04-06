import { Request, Response, NextFunction } from 'express';
import { pautadoresService } from './pautadores.service';
import { sendSuccess } from '../../utils/response.util';
import { exportExcelService } from '../../services/export-excel.service';
import { exportPdfService } from '../../services/export-pdf.service';
import { googleAdsSyncService } from '../../services/google-ads-sync.service';
import { googleAdsAnalysisService } from '../../services/google-ads-analysis.service';
import { parsePagination, buildPaginationMeta } from '../../utils/pagination.util';
import { query as dbQuery } from '../../config/database';

export class PautadoresController {
  async getEntriesDaily(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await pautadoresService.getEntriesDaily(req.query);
      return sendSuccess(res, result.data, result.meta);
    } catch (err) { next(err); }
  }

  async getEntriesWeekly(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await pautadoresService.getEntriesWeekly(req.query);
      return sendSuccess(res, result);
    } catch (err) { next(err); }
  }

  async getEntriesWeeklyCalendar(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await pautadoresService.getEntriesWeeklyCalendar(req.query);
      return sendSuccess(res, result);
    } catch (err) { next(err); }
  }

  async getConsolidated(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await pautadoresService.getConsolidated(req.query);
      return sendSuccess(res, result.data, result.meta);
    } catch (err) { next(err); }
  }

  async getCampaigns(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await pautadoresService.getCampaigns(req.query);
      return sendSuccess(res, result);
    } catch (err) { next(err); }
  }

  async getDashboardKpis(req: Request, res: Response, next: NextFunction) {
    try {
      const kpis = await pautadoresService.getDashboardKpis(req.query);
      return sendSuccess(res, kpis);
    } catch (err) { next(err); }
  }

  async getDashboardCharts(req: Request, res: Response, next: NextFunction) {
    try {
      const charts = await pautadoresService.getDashboardCharts(req.query);
      return sendSuccess(res, charts);
    } catch (err) { next(err); }
  }

  async exportExcel(req: Request, res: Response, next: NextFunction) {
    try {
      const buffer = await exportExcelService.generateConsolidatedReport(req.query);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=reporte_pautas_${Date.now()}.xlsx`);
      return res.send(buffer);
    } catch (err) { next(err); }
  }

  async exportPdf(req: Request, res: Response, next: NextFunction) {
    try {
      const buffer = await exportPdfService.generateConsolidatedReport(req.query);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=reporte_pautas_${Date.now()}.pdf`);
      return res.send(buffer);
    } catch (err) { next(err); }
  }

  // ============ Google Ads Endpoints ============

  async getMyGoogleAdsAccounts(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const result = await dbQuery(
        'SELECT google_ads_account_id FROM user_google_ads_accounts WHERE user_id = $1',
        [userId]
      );
      return sendSuccess(res, result.rows.map((r: any) => r.google_ads_account_id));
    } catch (err) { next(err); }
  }

  async getGoogleAdsCampaigns(req: Request, res: Response, next: NextFunction) {
    try {
      const countryId = req.query.country_id ? Number(req.query.country_id) : undefined;
      const data = await googleAdsSyncService.getCampaignDetails(countryId);
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  async getGoogleAdsCampaignsByAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const countryId = req.query.country_id ? Number(req.query.country_id) : undefined;
      const userId = (req as any).user.id;
      const userRole = (req as any).user.role;

      let accountIds: string[] | undefined;
      if (userRole === 'pautador' && req.query.show_all !== 'true') {
        const result = await dbQuery(
          'SELECT google_ads_account_id FROM user_google_ads_accounts WHERE user_id = $1',
          [userId]
        );
        const ids = result.rows.map((r: any) => r.google_ads_account_id);
        if (ids.length > 0) {
          accountIds = ids;
        }
      }

      const data = await googleAdsSyncService.getCampaignsGroupedByAccount(countryId, accountIds);
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  async getGoogleAdsCampaignHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const campaignId = Number(req.params.id);
      const days = req.query.days ? Number(req.query.days) : 30;
      const data = await googleAdsSyncService.getCampaignHistory(campaignId, days);
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  async getGoogleAdsBillingAccounts(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await googleAdsSyncService.getBillingAccounts();
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  async getGoogleAdsBillingHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const { limit, offset, page } = parsePagination(req.query);
      const result = await googleAdsSyncService.getBillingHistory(limit, offset);
      return sendSuccess(res, result.rows, buildPaginationMeta(page, limit, result.total));
    } catch (err) { next(err); }
  }

  async getGoogleAdsAccountCharges(req: Request, res: Response, next: NextFunction) {
    try {
      const { limit, offset, page } = parsePagination(req.query);
      const result = await googleAdsSyncService.getAccountCharges(limit, offset);
      return sendSuccess(res, result.rows, buildPaginationMeta(page, limit, result.total));
    } catch (err) { next(err); }
  }

  async getGoogleAdsRecharges(req: Request, res: Response, next: NextFunction) {
    try {
      const { limit, offset, page } = parsePagination(req.query);
      const { dateFrom, dateTo, account, paymentProfile } = req.query as any;
      const userId = (req as any).user.id;
      const userRole = (req as any).user.role;

      let accountIds: string[] | undefined;
      if (userRole === 'pautador' && req.query.show_all !== 'true') {
        const result = await dbQuery(
          'SELECT google_ads_account_id FROM user_google_ads_accounts WHERE user_id = $1',
          [userId]
        );
        const ids = result.rows.map((r: any) => r.google_ads_account_id);
        if (ids.length > 0) {
          accountIds = ids;
        }
      }

      const result = await googleAdsSyncService.getRecharges(limit, offset, {
        dateFrom, dateTo, account, paymentProfile, accountIds,
      });
      return sendSuccess(res, result.rows, buildPaginationMeta(page, limit, result.total));
    } catch (err) { next(err); }
  }

  async exportRechargesCsv(req: Request, res: Response, next: NextFunction) {
    try {
      const { dateFrom, dateTo, account, paymentProfile } = req.query as any;
      const csv = await googleAdsSyncService.exportRechargesCsv({
        dateFrom, dateTo, account, paymentProfile,
      });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=recargas.csv');
      // BOM for Excel UTF-8 support
      res.send('\uFEFF' + csv);
    } catch (err) { next(err); }
  }

  async getRechargesDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const { country, dateFrom, dateTo, account, paymentProfile } = req.query as any;
      const data = await googleAdsSyncService.getRechargesDashboard({
        country, dateFrom, dateTo, account, paymentProfile,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  async triggerGoogleAdsSync(req: Request, res: Response, next: NextFunction) {
    try {
      const full = req.query.full === 'true';
      await googleAdsSyncService.syncAllCampaigns(!full);
      // Also sync billing data (recharges — recent only for speed)
      await googleAdsSyncService.syncBillingAccounts();
      await googleAdsSyncService.syncRecharges(true);
      await googleAdsSyncService.syncAccountCharges();
      return sendSuccess(res, { message: 'Sincronización completada (campañas + recargas)' });
    } catch (err) { next(err); }
  }

  // ============ Google Ads Analysis Endpoints ============

  async getAnalysisDataRange(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await googleAdsAnalysisService.getDataRange();
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  async getAnalysisSpendingTrend(req: Request, res: Response, next: NextFunction) {
    try {
      const { granularity, date_from, date_to, account_id, country_id } = req.query as any;
      const data = await googleAdsAnalysisService.getSpendingTrend({
        granularity: granularity || 'daily',
        dateFrom: date_from,
        dateTo: date_to,
        accountId: account_id || undefined,
        countryId: country_id ? Number(country_id) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  async getAnalysisPerformance(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, account_id, country_id } = req.query as any;
      const data = await googleAdsAnalysisService.getPerformanceMetrics({
        dateFrom: date_from,
        dateTo: date_to,
        accountId: account_id || undefined,
        countryId: country_id ? Number(country_id) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  async getAnalysisRankings(req: Request, res: Response, next: NextFunction) {
    try {
      const { metric, sort, limit, date_from, date_to } = req.query as any;
      const data = await googleAdsAnalysisService.getAccountRankings({
        metric: metric || 'spend',
        sort: sort || 'top',
        limit: limit ? Number(limit) : 10,
        dateFrom: date_from,
        dateTo: date_to,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  async getAnalysisBudgetDistribution(req: Request, res: Response, next: NextFunction) {
    try {
      const countryId = req.query.country_id ? Number(req.query.country_id) : undefined;
      const data = await googleAdsAnalysisService.getBudgetDistribution({ countryId });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  // ============ Conglomerado Contrast Endpoint ============

  async getConglomeradoContrast(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, country_id } = req.query as any;
      const values: any[] = [date_from, date_to];
      let countryFilter = '';
      let paramIdx = 3;

      if (country_id) {
        countryFilter = `AND u.country_id = $${paramIdx}`;
        values.push(Number(country_id));
        paramIdx++;
      }

      const sql = `
        WITH user_entries AS (
          SELECT u.id as user_id, u.full_name, u.google_ads_account_id, u.username,
                 c.name as country_name,
                 COALESCE(SUM(de.clientes), 0) as total_clientes,
                 COALESCE(SUM(de.clientes_efectivos), 0) as total_clientes_efectivos,
                 COALESCE(SUM(de.menores), 0) as total_menores,
                 COUNT(de.id) as entry_count
          FROM users u
          JOIN roles r ON r.id = u.role_id
          LEFT JOIN countries c ON c.id = u.country_id
          LEFT JOIN daily_entries de ON de.user_id = u.id
            AND de.entry_date BETWEEN $1 AND $2
          WHERE r.name = 'conglomerado' AND u.is_active = TRUE
            AND u.google_ads_account_id IS NOT NULL
            ${countryFilter}
          GROUP BY u.id, u.full_name, u.google_ads_account_id, u.username, c.name
        ),
        account_metrics AS (
          SELECT c.customer_account_id,
                 SUM(gs.clicks) as total_clicks,
                 SUM(gs.impressions) as total_impressions,
                 SUM(gs.conversions) as total_conversions,
                 SUM(gs.cost) as total_cost,
                 SUM(COALESCE(gs.daily_budget, 0)) as total_budget
          FROM campaigns c
          JOIN google_ads_snapshots gs ON gs.campaign_id = c.id
            AND gs.snapshot_date BETWEEN $1 AND $2
          GROUP BY c.customer_account_id
        )
        SELECT ue.*, am.total_clicks, am.total_impressions,
               am.total_conversions, am.total_cost, am.total_budget
        FROM user_entries ue
        LEFT JOIN account_metrics am ON am.customer_account_id = ue.google_ads_account_id
        ORDER BY ue.full_name
      `;

      const result = await dbQuery(sql, values);
      return sendSuccess(res, result.rows);
    } catch (err) { next(err); }
  }
}

export const pautadoresController = new PautadoresController();
