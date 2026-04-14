import { Request, Response, NextFunction } from 'express';
import { pautadoresService } from './pautadores.service';
import { sendSuccess, sendError } from '../../utils/response.util';
import { exportExcelService } from '../../services/export-excel.service';
import { exportPdfService } from '../../services/export-pdf.service';
import { googleAdsSyncService } from '../../services/google-ads-sync.service';
import { googleAdsAnalysisService } from '../../services/google-ads-analysis.service';
import { parsePagination, buildPaginationMeta } from '../../utils/pagination.util';
import { query as dbQuery } from '../../config/database';
import { scheduledReportsService } from '../../services/scheduled-reports.service';

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
      const enhanced = req.query.enhanced === 'true';
      const backfill = req.query.backfill === 'true';
      await googleAdsSyncService.syncAllCampaigns(!full);
      // Also sync billing data (recharges — recent only for speed)
      await googleAdsSyncService.syncBillingAccounts();
      await googleAdsSyncService.syncRecharges(true);
      await googleAdsSyncService.syncAccountCharges();

      if (enhanced) {
        await googleAdsSyncService.syncEnhancedAnalytics(backfill);
      }

      const msg = enhanced
        ? `Sincronización completada (campañas + recargas + analíticas avanzadas${backfill ? ' BACKFILL 30 días' : ''})`
        : 'Sincronización completada (campañas + recargas)';
      return sendSuccess(res, { message: msg });
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

  async getAnalysisImpressionShare(req: Request, res: Response, next: NextFunction) {
    try {
      const { granularity, date_from, date_to, account_id, country_id } = req.query as any;
      const data = await googleAdsAnalysisService.getImpressionShareTrend({
        granularity: granularity || 'daily',
        dateFrom: date_from,
        dateTo: date_to,
        accountId: account_id,
        countryId: country_id ? Number(country_id) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  async getAnalysisCampaignTypes(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, account_id, country_id } = req.query as any;
      const data = await googleAdsAnalysisService.getCampaignTypeBreakdown({
        dateFrom: date_from,
        dateTo: date_to,
        accountId: account_id,
        countryId: country_id ? Number(country_id) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  async getAnalysisBiddingStrategies(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, account_id, country_id } = req.query as any;
      const data = await googleAdsAnalysisService.getBiddingStrategyAnalysis({
        dateFrom: date_from,
        dateTo: date_to,
        accountId: account_id,
        countryId: country_id ? Number(country_id) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  async getAnalysisKeywords(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, metric, match_type, account_id, country_id, limit } = req.query as any;
      const data = await googleAdsAnalysisService.getTopKeywords({
        dateFrom: date_from,
        dateTo: date_to,
        metric,
        matchType: match_type,
        accountId: account_id,
        countryId: country_id ? Number(country_id) : undefined,
        limit: limit ? Number(limit) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  async getAnalysisKeywordQuality(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, account_id, country_id } = req.query as any;
      const data = await googleAdsAnalysisService.getKeywordQualityDistribution({
        dateFrom: date_from,
        dateTo: date_to,
        accountId: account_id,
        countryId: country_id ? Number(country_id) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  async getAnalysisDevices(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, account_id, country_id } = req.query as any;
      const data = await googleAdsAnalysisService.getDeviceBreakdown({
        dateFrom: date_from,
        dateTo: date_to,
        accountId: account_id,
        countryId: country_id ? Number(country_id) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  async getAnalysisGeo(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, account_id, country_id, limit } = req.query as any;
      const data = await googleAdsAnalysisService.getGeoPerformance({
        dateFrom: date_from,
        dateTo: date_to,
        accountId: account_id,
        countryId: country_id ? Number(country_id) : undefined,
        limit: limit ? Number(limit) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  async getAnalysisHourlyHeatmap(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, metric, account_id, country_id } = req.query as any;
      const data = await googleAdsAnalysisService.getHourlyHeatmap({
        dateFrom: date_from,
        dateTo: date_to,
        metric,
        accountId: account_id,
        countryId: country_id ? Number(country_id) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  // ============ Budget Intelligence Endpoints ============

  async getAnalysisBudgetPacing(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, account_id, country_id } = req.query as any;
      const data = await googleAdsAnalysisService.getBudgetPacing({
        dateFrom: date_from,
        dateTo: date_to,
        accountId: account_id,
        countryId: country_id ? Number(country_id) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  async getAnalysisWasteDetection(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, account_id, country_id } = req.query as any;
      const data = await googleAdsAnalysisService.getWasteDetection({
        dateFrom: date_from,
        dateTo: date_to,
        accountId: account_id,
        countryId: country_id ? Number(country_id) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  async getAnalysisOptimalSchedule(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, account_id, country_id } = req.query as any;
      const data = await googleAdsAnalysisService.getOptimalSchedule({
        dateFrom: date_from,
        dateTo: date_to,
        accountId: account_id,
        countryId: country_id ? Number(country_id) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  async getAnalysisBudgetForecast(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, account_id, country_id } = req.query as any;
      const data = await googleAdsAnalysisService.getBudgetForecast({
        dateFrom: date_from,
        dateTo: date_to,
        accountId: account_id,
        countryId: country_id ? Number(country_id) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  async getAnalysisBudgetRedistribution(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, account_id, country_id } = req.query as any;
      const data = await googleAdsAnalysisService.getBudgetRedistribution({
        dateFrom: date_from,
        dateTo: date_to,
        accountId: account_id,
        countryId: country_id ? Number(country_id) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  async getAnalysisSmartBudgetRecommendations(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, account_id, country_id } = req.query as any;
      const data = await googleAdsAnalysisService.getSmartBudgetRecommendations({
        dateFrom: date_from,
        dateTo: date_to,
        accountId: account_id,
        countryId: country_id ? Number(country_id) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  // ============ Phase 2: Comparaciones & Tendencias ============

  async getAnalysisTemporalComparison(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from_1, date_to_1, date_from_2, date_to_2, account_id, country_id } = req.query as any;
      const data = await googleAdsAnalysisService.getTemporalComparison({
        dateFrom1: date_from_1,
        dateTo1: date_to_1,
        dateFrom2: date_from_2,
        dateTo2: date_to_2,
        accountId: account_id,
        countryId: country_id ? Number(country_id) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  async getAnalysisCPAAnalysis(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, account_id, country_id } = req.query as any;
      const data = await googleAdsAnalysisService.getCPAAnalysis({
        dateFrom: date_from,
        dateTo: date_to,
        accountId: account_id,
        countryId: country_id ? Number(country_id) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  async getAnalysisQualityScoreTrend(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, account_id, country_id } = req.query as any;
      const data = await googleAdsAnalysisService.getQualityScoreTrend({
        dateFrom: date_from,
        dateTo: date_to,
        accountId: account_id,
        countryId: country_id ? Number(country_id) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  async getAnalysisCPCTrend(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, account_id, country_id } = req.query as any;
      const data = await googleAdsAnalysisService.getCPCTrend({
        dateFrom: date_from,
        dateTo: date_to,
        accountId: account_id,
        countryId: country_id ? Number(country_id) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  async getAnalysisSeasonality(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, account_id, country_id } = req.query as any;
      const data = await googleAdsAnalysisService.getSeasonalityPatterns({
        dateFrom: date_from,
        dateTo: date_to,
        accountId: account_id,
        countryId: country_id ? Number(country_id) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  // ============ Phase 4: Search Terms & Keywords ============

  async getAnalysisSearchTerms(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, account_id, country_id, limit } = req.query as any;
      const data = await googleAdsAnalysisService.getSearchTerms({
        dateFrom: date_from,
        dateTo: date_to,
        accountId: account_id,
        countryId: country_id ? Number(country_id) : undefined,
        limit: limit ? Number(limit) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  async getAnalysisNegativeKeywordCandidates(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, account_id, country_id } = req.query as any;
      const data = await googleAdsAnalysisService.getNegativeKeywordCandidates({
        dateFrom: date_from,
        dateTo: date_to,
        accountId: account_id,
        countryId: country_id ? Number(country_id) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  async getAnalysisLongTail(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, account_id, country_id } = req.query as any;
      const data = await googleAdsAnalysisService.getLongTailAnalysis({
        dateFrom: date_from,
        dateTo: date_to,
        accountId: account_id,
        countryId: country_id ? Number(country_id) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  async getAnalysisKeywordCannibalization(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, account_id, country_id } = req.query as any;
      const data = await googleAdsAnalysisService.getKeywordCannibalization({
        dateFrom: date_from,
        dateTo: date_to,
        accountId: account_id,
        countryId: country_id ? Number(country_id) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  // ============ Phase 5: Ad Performance & Fatigue Detection ============

  async getAnalysisAdPerformanceComparison(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, account_id, country_id } = req.query as any;
      const data = await googleAdsAnalysisService.getAdPerformanceComparison({
        dateFrom: date_from,
        dateTo: date_to,
        accountId: account_id,
        countryId: country_id ? Number(country_id) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  async getAnalysisAdFatigue(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, account_id, country_id } = req.query as any;
      const data = await googleAdsAnalysisService.getAdFatigueDetection({
        dateFrom: date_from,
        dateTo: date_to,
        accountId: account_id,
        countryId: country_id ? Number(country_id) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  async getAnalysisAdTypePerformance(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, account_id, country_id } = req.query as any;
      const data = await googleAdsAnalysisService.getAdTypePerformance({
        dateFrom: date_from,
        dateTo: date_to,
        accountId: account_id,
        countryId: country_id ? Number(country_id) : undefined,
      });
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

  // ============ Phase 6: Competitive Intelligence / Auction Insights ============

  async getAnalysisAuctionInsights(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, account_id, country_id } = req.query as any;
      const data = await googleAdsAnalysisService.getAuctionInsightsSummary({
        dateFrom: date_from,
        dateTo: date_to,
        accountId: account_id,
        countryId: country_id ? Number(country_id) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  async getAnalysisCompetitivePosition(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, account_id, country_id } = req.query as any;
      const data = await googleAdsAnalysisService.getCompetitivePosition({
        dateFrom: date_from,
        dateTo: date_to,
        accountId: account_id,
        countryId: country_id ? Number(country_id) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  async getAnalysisMarketOpportunities(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, account_id, country_id } = req.query as any;
      const data = await googleAdsAnalysisService.getMarketOpportunities({
        dateFrom: date_from,
        dateTo: date_to,
        accountId: account_id,
        countryId: country_id ? Number(country_id) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  // ============ Phase 7: Demographics ============

  async getAnalysisAgeBreakdown(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, account_id, country_id } = req.query as any;
      const data = await googleAdsAnalysisService.getAgeBreakdown({
        dateFrom: date_from,
        dateTo: date_to,
        accountId: account_id,
        countryId: country_id ? Number(country_id) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  async getAnalysisGenderBreakdown(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, account_id, country_id } = req.query as any;
      const data = await googleAdsAnalysisService.getGenderBreakdown({
        dateFrom: date_from,
        dateTo: date_to,
        accountId: account_id,
        countryId: country_id ? Number(country_id) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  // ============ Phase 8: Scheduled Reports ============

  async getScheduledReports(req: Request, res: Response, next: NextFunction) {
    try {
      const userRole = (req as any).user.role;
      const userId = (req as any).user.id;
      const reports = await scheduledReportsService.getAll(userRole === 'admin' ? undefined : userId);
      return sendSuccess(res, reports);
    } catch (err) { next(err); }
  }

  async createScheduledReport(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const report = await scheduledReportsService.create({ ...req.body, created_by: userId });
      return sendSuccess(res, report);
    } catch (err) { next(err); }
  }

  async updateScheduledReport(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const report = await scheduledReportsService.update(id, req.body);
      return sendSuccess(res, report);
    } catch (err) { next(err); }
  }

  async deleteScheduledReport(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const deleted = await scheduledReportsService.delete(id);
      return sendSuccess(res, { deleted });
    } catch (err) { next(err); }
  }

  // ============ Phase 9: Enhanced Tabs ============

  async getAnalysisDeviceBidRecommendations(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, account_id, country_id } = req.query as any;
      const data = await googleAdsAnalysisService.getDeviceBidRecommendations({
        dateFrom: date_from,
        dateTo: date_to,
        accountId: account_id || undefined,
        countryId: country_id ? Number(country_id) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  async getAnalysisDeviceExclusions(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, account_id, country_id } = req.query as any;
      const data = await googleAdsAnalysisService.getDeviceExclusions({
        dateFrom: date_from,
        dateTo: date_to,
        accountId: account_id || undefined,
        countryId: country_id ? Number(country_id) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  async getAnalysisGeoTierClassification(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, account_id, country_id } = req.query as any;
      const data = await googleAdsAnalysisService.getGeoTierClassification({
        dateFrom: date_from,
        dateTo: date_to,
        accountId: account_id || undefined,
        countryId: country_id ? Number(country_id) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  async getAnalysisRegionalPatterns(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, account_id, country_id } = req.query as any;
      const data = await googleAdsAnalysisService.getRegionalPatterns({
        dateFrom: date_from,
        dateTo: date_to,
        accountId: account_id || undefined,
        countryId: country_id ? Number(country_id) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  async getAnalysisKeywordActionPlan(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, account_id, country_id } = req.query as any;
      const data = await googleAdsAnalysisService.getKeywordActionPlan({
        dateFrom: date_from,
        dateTo: date_to,
        accountId: account_id || undefined,
        countryId: country_id ? Number(country_id) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  async getAnalysisMatchTypeRecommendations(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, account_id, country_id } = req.query as any;
      const data = await googleAdsAnalysisService.getMatchTypeRecommendations({
        dateFrom: date_from,
        dateTo: date_to,
        accountId: account_id || undefined,
        countryId: country_id ? Number(country_id) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  async getAnalysisCrossAccountKeywords(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, account_id, country_id } = req.query as any;
      const data = await googleAdsAnalysisService.getCrossAccountKeywords({
        dateFrom: date_from,
        dateTo: date_to,
        accountId: account_id || undefined,
        countryId: country_id ? Number(country_id) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  async getAnalysisFullForecast(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, account_id, country_id } = req.query as any;
      const data = await googleAdsAnalysisService.getFullForecast({
        dateFrom: date_from,
        dateTo: date_to,
        accountId: account_id || undefined,
        countryId: country_id ? Number(country_id) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  async getAnalysisScalingHealth(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, account_id, country_id } = req.query as any;
      const data = await googleAdsAnalysisService.getScalingHealth({
        dateFrom: date_from,
        dateTo: date_to,
        accountId: account_id || undefined,
        countryId: country_id ? Number(country_id) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  async getAnalysisCompetitiveMarketTrend(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, account_id, country_id } = req.query as any;
      const data = await googleAdsAnalysisService.getCompetitiveMarketTrend({
        dateFrom: date_from,
        dateTo: date_to,
        accountId: account_id || undefined,
        countryId: country_id ? Number(country_id) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  // ============ Phase 10: Dashboard Ejecutivo ============

  async getAnalysisAccountHealthScores(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, account_id, country_id } = req.query as any;
      const data = await googleAdsAnalysisService.getAccountHealthScores({
        dateFrom: date_from, dateTo: date_to,
        accountId: account_id || undefined,
        countryId: country_id ? Number(country_id) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  async getAnalysisExecutiveSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, account_id, country_id } = req.query as any;
      const data = await googleAdsAnalysisService.getExecutiveSummary({
        dateFrom: date_from, dateTo: date_to,
        accountId: account_id || undefined,
        countryId: country_id ? Number(country_id) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  async getAnalysisTopRecommendations(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, account_id, country_id } = req.query as any;
      const data = await googleAdsAnalysisService.getTopRecommendations({
        dateFrom: date_from, dateTo: date_to,
        accountId: account_id || undefined,
        countryId: country_id ? Number(country_id) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  // ============ Phase 11: Auditoria Financiera ============

  async getAnalysisZombieKeywords(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, account_id, country_id } = req.query as any;
      const data = await googleAdsAnalysisService.getZombieKeywords({
        dateFrom: date_from, dateTo: date_to,
        accountId: account_id || undefined,
        countryId: country_id ? Number(country_id) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  async getAnalysisVampireCampaigns(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, account_id, country_id } = req.query as any;
      const data = await googleAdsAnalysisService.getVampireCampaigns({
        dateFrom: date_from, dateTo: date_to,
        accountId: account_id || undefined,
        countryId: country_id ? Number(country_id) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  async getAnalysisConsolidatedActionPlan(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, account_id, country_id } = req.query as any;
      const data = await googleAdsAnalysisService.getConsolidatedActionPlan({
        dateFrom: date_from, dateTo: date_to,
        accountId: account_id || undefined,
        countryId: country_id ? Number(country_id) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  // ============ Phase 12: Benchmark Cross-Account ============

  async getAnalysisAccountBenchmark(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, account_id, country_id } = req.query as any;
      const data = await googleAdsAnalysisService.getAccountBenchmark({
        dateFrom: date_from, dateTo: date_to,
        accountId: account_id || undefined,
        countryId: country_id ? Number(country_id) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  async getAnalysisPortfolioRecommendation(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, account_id, country_id } = req.query as any;
      const data = await googleAdsAnalysisService.getPortfolioRecommendation({
        dateFrom: date_from, dateTo: date_to,
        accountId: account_id || undefined,
        countryId: country_id ? Number(country_id) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  async getAnalysisAccountPatterns(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, account_id, country_id } = req.query as any;
      const data = await googleAdsAnalysisService.getAccountPatterns({
        dateFrom: date_from, dateTo: date_to,
        accountId: account_id || undefined,
        countryId: country_id ? Number(country_id) : undefined,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  // ============ ML Predictive Analysis ============

  async getAnalysisPredictiveBudget(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, account_id } = req.query as any;
      if (!account_id) {
        return sendError(res, 'MISSING_PARAM', 'account_id parameter is required', 400);
      }
      const data = await googleAdsAnalysisService.getPredictiveAnalysis({
        dateFrom: date_from,
        dateTo: date_to,
        accountId: account_id,
      });
      return sendSuccess(res, data);
    } catch (err) { next(err); }
  }
}

export const pautadoresController = new PautadoresController();
