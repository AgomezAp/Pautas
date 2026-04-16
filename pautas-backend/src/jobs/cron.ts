import cron from 'node-cron';
import { logger } from '../utils/logger.util';
import { googleAdsSyncService } from '../services/google-ads-sync.service';
import { weeklySummaryService } from '../services/weekly-summary.service';
import { alertsEngineService } from '../services/alerts-engine.service';
import { notificationEmailService } from '../services/notification-email.service';
import { imageCleanupService } from '../services/image-cleanup.service';
import { scheduledReportsService } from '../services/scheduled-reports.service';
import { cacheService } from '../services/cache.service';

export function registerCronJobs() {
  // Google Ads campaigns + recharges sync: every hour (ACTIVE accounts only, skips PAUSADA)
  cron.schedule('0 * * * *', async () => {
    logger.info('[CRON] Starting Google Ads hourly sync (active accounts + recharges)...');
    try {
      await googleAdsSyncService.syncAllCampaigns(true);
      await googleAdsSyncService.syncRecharges(true);
      logger.info('[CRON] Hourly sync completed (campaigns + recharges)');
      await cacheService.invalidatePattern('gestion:*');
    } catch (error: any) {
      logger.error('[CRON] Google Ads hourly sync error: ' + error.message);
    }
  });

  // Google Ads FULL sync: daily at 3:00 AM (ALL accounts including PAUSADA)
  cron.schedule('0 3 * * *', async () => {
    logger.info('[CRON] Starting Google Ads full daily sync (all accounts)...');
    try {
      await googleAdsSyncService.syncAllCampaigns(false);
      await cacheService.invalidatePattern('gestion:*');
    } catch (error: any) {
      logger.error('[CRON] Google Ads full sync error: ' + error.message);
    }
  });

  // Google Ads billing + recharges sync: daily at 2:00 AM
  cron.schedule('0 2 * * *', async () => {
    logger.info('[CRON] Starting Google Ads billing sync...');
    try {
      await googleAdsSyncService.syncBillingAccounts();
      await googleAdsSyncService.syncAccountCharges();
      await googleAdsSyncService.syncRecharges();
      await googleAdsSyncService.syncBillingHistory();
      logger.info('[CRON] Billing sync completed');
      await cacheService.invalidatePattern('gestion:*');
    } catch (error: any) {
      logger.error('[CRON] Google Ads billing sync error: ' + error.message);
    }
  });

  // Weekly summaries recomputation: daily at 1:00 AM
  cron.schedule('0 1 * * *', async () => {
    logger.info('[CRON] Recomputing weekly summaries...');
    try {
      await weeklySummaryService.recomputeCurrentWeek();
      await cacheService.invalidatePattern('cong:weekly:*');
      await cacheService.invalidatePattern('gestion:by-week:*');
    } catch (error: any) {
      logger.error('[CRON] Weekly summary error: ' + error.message);
    }
  });

  logger.info('Cron jobs registered: Campaigns+Recharges hourly (active), Full sync (daily 3AM), Billing (daily 2AM), Weekly summaries (daily 1AM)');

  // ─── ALERTAS: Detectar conglomerados sin reporte a las 7:00 PM ────
  cron.schedule('0 19 * * 1-5', async () => {
    logger.info('[CRON] Detecting NO_REPORT alerts...');
    try {
      const count = await alertsEngineService.detectNoReports();
      logger.info(`[CRON] NO_REPORT detection completed: ${count} alert(s)`);
    } catch (error: any) {
      logger.error('[CRON] NO_REPORT detection error: ' + error.message);
    }
  });

  // ─── ALERTAS: Detectar tendencias + discrepancias Ads a las 6:00 AM ────
  cron.schedule('0 6 * * 1-5', async () => {
    logger.info('[CRON] Starting trend + Ads discrepancy detection...');
    try {
      await alertsEngineService.detectTrends();
      await alertsEngineService.detectAdsDiscrepancy();
      logger.info('[CRON] Trend + Ads discrepancy detection completed');
    } catch (error: any) {
      logger.error('[CRON] Trend detection error: ' + error.message);
    }
  });

  // ─── ALERTAS: Recalcular conglomerate_stats (domingos a la 1:30 AM) ────
  cron.schedule('30 1 * * 0', async () => {
    logger.info('[CRON] Recomputing conglomerate_stats...');
    try {
      await alertsEngineService.recomputeStats();
      logger.info('[CRON] conglomerate_stats recomputed');
      await cacheService.invalidatePattern('admin:stats');
    } catch (error: any) {
      logger.error('[CRON] conglomerate_stats error: ' + error.message);
    }
  });

  // ─── EMAIL: Resumen diario a las 8:00 PM ────
  cron.schedule('0 20 * * 1-5', async () => {
    logger.info('[CRON] Sending daily summary email...');
    try {
      const summary = await alertsEngineService.getDailySummary();
      const emails = await alertsEngineService.getPautadorEmails();
      await notificationEmailService.sendDailySummary(emails, summary);
      logger.info('[CRON] Daily summary email sent');
    } catch (error: any) {
      logger.error('[CRON] Daily summary email error: ' + error.message);
    }
  });

  logger.info('Alert cron jobs registered: NO_REPORT (7PM L-V), Trends (6AM L-V), Stats (Sun 1:30AM), Email (8PM L-V)');

  // ─── LIMPIEZA: Eliminar imágenes con más de 14 días (diario a las 4:00 AM) ────
  cron.schedule('0 4 * * *', async () => {
    logger.info('[CRON] Starting image cleanup (>14 days)...');
    try {
      const result = await imageCleanupService.cleanupOldImages();
      logger.info(`[CRON] Image cleanup completed: ${result.deletedFiles} files deleted, ${result.errors} errors`);
      await cacheService.invalidatePattern('gestion:soporte-images:*');
    } catch (error: any) {
      logger.error('[CRON] Image cleanup error: ' + error.message);
    }
  });

  logger.info('Image cleanup cron registered: daily at 4:00 AM (>14 days)');

  // ─── DISTRIBUTED ENHANCED ANALYTICS: One method per slot, spreads load throughout the day ────
  // Instead of running ALL 8 methods every 3 hours (which generates hundreds of API calls),
  // we distribute them across the day. Each method syncs LAST_3_DAYS by default.
  // Schedule: 6AM keywords, 8AM devices, 10AM geo, 12PM hourly,
  //           2PM searchTerms, 4PM adPerformance, 6PM demographics, 8PM assets
  // By 8PM all data is fresh. Daily 3AM backfill covers anything missed.

  const distributedSchedule: { cron: string; method: string; label: string }[] = [
    { cron: '0 6 * * *',  method: 'keywords',      label: 'Keywords' },
    { cron: '0 8 * * *',  method: 'devices',        label: 'Devices' },
    { cron: '0 10 * * *', method: 'geo',             label: 'Geo' },
    { cron: '0 12 * * *', method: 'hourly',          label: 'Hourly' },
    { cron: '0 14 * * *', method: 'searchTerms',     label: 'Search Terms' },
    { cron: '0 16 * * *', method: 'adPerformance',   label: 'Ad Performance' },
    { cron: '0 18 * * *', method: 'demographics',    label: 'Demographics' },
    { cron: '0 20 * * *', method: 'assets',           label: 'Assets' },
  ];

  for (const slot of distributedSchedule) {
    cron.schedule(slot.cron, async () => {
      logger.info(`[CRON] [DISTRIBUTED] Starting ${slot.label} sync...`);
      try {
        const ran = await googleAdsSyncService.syncSingleMethod(slot.method);
        if (ran) {
          logger.info(`[CRON] [DISTRIBUTED] ${slot.label} sync completed`);
          await cacheService.invalidatePattern('gestion:*');
        } else {
          logger.warn(`[CRON] [DISTRIBUTED] ${slot.label} skipped (rate limited)`);
        }
      } catch (error: any) {
        logger.error(`[CRON] [DISTRIBUTED] ${slot.label} sync error: ${error.message}`);
      }
    });
  }

  // Nightly full enhanced sync at 11PM — catches anything missed during the day
  cron.schedule('0 23 * * *', async () => {
    logger.info('[CRON] Starting nightly full enhanced analytics sync...');
    try {
      await googleAdsSyncService.syncEnhancedAnalytics(false);
      logger.info('[CRON] Nightly enhanced analytics sync completed');
      await cacheService.invalidatePattern('gestion:*');
    } catch (error: any) {
      logger.error('[CRON] Nightly enhanced analytics sync error: ' + error.message);
    }
  });

  logger.info('Distributed enhanced analytics cron registered: 6AM-8PM (one method every 2 hours) + 11PM full sweep');

  // ─── ALERTAS PRESUPUESTO: Detectar sobregasto/subgasto/agotamiento (diario 12 PM y 6 PM) ────
  cron.schedule('0 12,18 * * 1-5', async () => {
    logger.info('[CRON] Starting budget alert detection...');
    try {
      const count = await alertsEngineService.detectBudgetAlerts();
      logger.info(`[CRON] Budget alert detection completed: ${count} alert(s)`);
    } catch (error: any) {
      logger.error('[CRON] Budget alert detection error: ' + error.message);
    }
  });

  logger.info('Budget alerts cron registered: daily at 12PM & 6PM (Mon-Fri)');

  // ─── ALERTAS ANOMALÍAS: CPC spike, CTR anomaly, IS drop, QS drop, oportunidades (7 AM L-V) ────
  cron.schedule('0 7 * * 1-5', async () => {
    logger.info('[CRON] Starting Google Ads anomaly detection...');
    try {
      const count = await alertsEngineService.detectGoogleAdsAnomalies();
      logger.info(`[CRON] Anomaly detection completed: ${count} alert(s)`);
    } catch (error: any) {
      logger.error('[CRON] Anomaly detection error: ' + error.message);
    }
  });

  logger.info('Anomaly detection cron registered: daily at 7AM (Mon-Fri)');

  // ─── AUCTION INSIGHTS: Sync semanal (domingos a las 5:00 AM) ────
  cron.schedule('0 5 * * 0', async () => {
    logger.info('[CRON] Starting auction insights weekly sync...');
    try {
      await googleAdsSyncService.syncAuctionInsights();
      logger.info('[CRON] Auction insights sync completed');
      await cacheService.invalidatePattern('gestion:*');
    } catch (error: any) {
      logger.error('[CRON] Auction insights sync error: ' + error.message);
    }
  });

  logger.info('Auction insights cron registered: weekly on Sundays at 5AM');

  // ─── SCHEDULED REPORTS: Weekly reports (Monday 8 AM) ────
  cron.schedule('0 8 * * 1', async () => {
    logger.info('[CRON] Processing weekly scheduled reports...');
    try {
      const reports = await scheduledReportsService.getDueReports('WEEKLY');
      logger.info(`[CRON] ${reports.length} weekly reports due`);
      for (const report of reports) {
        try {
          const now = new Date();
          const dateTo = now.toISOString().split('T')[0];
          const dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          const filters = report.filters || {};
          const content = await scheduledReportsService.generateReportContent({
            dateFrom: filters.date_from || dateFrom,
            dateTo: filters.date_to || dateTo,
            accountId: filters.account_id,
            countryId: filters.country_id ? Number(filters.country_id) : undefined,
          });
          logger.info(`[CRON] Weekly report "${report.name}" generated: ${content.summary.total_accounts} accounts, $${content.summary.total_cost} total cost`);
          await scheduledReportsService.markSent(report.id);
        } catch (reportErr: any) {
          logger.error(`[CRON] Failed to generate report "${report.name}": ${reportErr.message}`);
        }
      }
    } catch (error: any) {
      logger.error('[CRON] Weekly scheduled reports error: ' + error.message);
    }
  });

  // ─── SCHEDULED REPORTS: Monthly reports (1st of month 8 AM) ────
  cron.schedule('0 8 1 * *', async () => {
    logger.info('[CRON] Processing monthly scheduled reports...');
    try {
      const reports = await scheduledReportsService.getDueReports('MONTHLY');
      logger.info(`[CRON] ${reports.length} monthly reports due`);
      for (const report of reports) {
        try {
          const now = new Date();
          const dateTo = now.toISOString().split('T')[0];
          const dateFrom = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString().split('T')[0];
          const filters = report.filters || {};
          const content = await scheduledReportsService.generateReportContent({
            dateFrom: filters.date_from || dateFrom,
            dateTo: filters.date_to || dateTo,
            accountId: filters.account_id,
            countryId: filters.country_id ? Number(filters.country_id) : undefined,
          });
          logger.info(`[CRON] Monthly report "${report.name}" generated: ${content.summary.total_accounts} accounts, $${content.summary.total_cost} total cost`);
          await scheduledReportsService.markSent(report.id);
        } catch (reportErr: any) {
          logger.error(`[CRON] Failed to generate report "${report.name}": ${reportErr.message}`);
        }
      }
    } catch (error: any) {
      logger.error('[CRON] Monthly scheduled reports error: ' + error.message);
    }
  });

  logger.info('Scheduled reports cron registered: weekly (Mon 8AM), monthly (1st 8AM)');
}
