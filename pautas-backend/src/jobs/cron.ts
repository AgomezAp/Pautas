import cron from 'node-cron';
import { logger } from '../utils/logger.util';
import { googleAdsSyncService } from '../services/google-ads-sync.service';
import { weeklySummaryService } from '../services/weekly-summary.service';
import { alertsEngineService } from '../services/alerts-engine.service';
import { notificationEmailService } from '../services/notification-email.service';
import { imageCleanupService } from '../services/image-cleanup.service';
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
}
