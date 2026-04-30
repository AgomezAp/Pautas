import cron from 'node-cron';
import { logger } from '../utils/logger.util';
import { googleAdsSyncService } from '../services/google-ads-sync.service';

export function registerCronJobs() {
  // ─── Campañas + recargas: cada hora (solo cuentas ACTIVAS) ────────────────
  cron.schedule('0 * * * *', async () => {
    logger.info('[CRON] Iniciando sync horario (cuentas activas + recargas)...');
    try {
      await googleAdsSyncService.syncAllCampaigns(true);
      await googleAdsSyncService.syncRecharges(true);
      logger.info('[CRON] Sync horario completado (campañas + recargas)');
    } catch (error: any) {
      logger.error('[CRON] Error en sync horario: ' + error.message);
    }
  });

  // ─── Sync completo diario (3 AM) — TODAS las cuentas incluyendo PAUSADAS ──
  cron.schedule('0 3 * * *', async () => {
    logger.info('[CRON] Iniciando sync completo diario (todas las cuentas)...');
    try {
      await googleAdsSyncService.syncAllCampaigns(false);
      logger.info('[CRON] Sync completo diario finalizado');
    } catch (error: any) {
      logger.error('[CRON] Error en sync completo diario: ' + error.message);
    }
  });

  // ─── Facturación + recargas: diario a las 2 AM ────────────────────────────
  cron.schedule('0 2 * * *', async () => {
    logger.info('[CRON] Iniciando sync de facturación...');
    try {
      await googleAdsSyncService.syncBillingAccounts();
      await googleAdsSyncService.syncAccountCharges();
      await googleAdsSyncService.syncRecharges();
      await googleAdsSyncService.syncBillingHistory();
      logger.info('[CRON] Sync de facturación completado');
    } catch (error: any) {
      logger.error('[CRON] Error en sync de facturación: ' + error.message);
    }
  });

  logger.info('Cron jobs registrados: Horario (activas+recargas), Sync completo (3AM), Facturación (2AM)');

  // ─── Analytics distribuido: un método cada 2 horas entre 6AM y 8PM ───────
  // Distribuye la carga a lo largo del día para evitar rate limits.
  // Para las 8PM todos los datos están frescos.
  const distributedSchedule: { cron: string; method: string; label: string }[] = [
    { cron: '0 6 * * *',  method: 'keywords',     label: 'Keywords' },
    { cron: '0 8 * * *',  method: 'devices',       label: 'Devices' },
    { cron: '0 10 * * *', method: 'geo',            label: 'Geo' },
    { cron: '0 12 * * *', method: 'hourly',         label: 'Hourly' },
    { cron: '0 14 * * *', method: 'searchTerms',    label: 'Search Terms' },
    { cron: '0 16 * * *', method: 'adPerformance',  label: 'Ad Performance' },
    { cron: '0 18 * * *', method: 'demographics',   label: 'Demographics' },
    { cron: '0 20 * * *', method: 'assets',          label: 'Assets' },
  ];

  for (const slot of distributedSchedule) {
    cron.schedule(slot.cron, async () => {
      logger.info(`[CRON] [DIST] Iniciando sync ${slot.label}...`);
      try {
        const ran = await googleAdsSyncService.syncSingleMethod(slot.method);
        if (ran) {
          logger.info(`[CRON] [DIST] Sync ${slot.label} completado`);
        } else {
          logger.warn(`[CRON] [DIST] Sync ${slot.label} omitido — rate limit activo`);
        }
      } catch (error: any) {
        logger.error(`[CRON] [DIST] ERROR en sync ${slot.label}: ${error.message}`);
      }
    });
  }

  // ─── Sync enhanced completo nocturno (11 PM) — cubre lo que falló en el día
  cron.schedule('0 23 * * *', async () => {
    logger.info('[CRON] Iniciando sync enhanced analytics completo nocturno...');
    try {
      await googleAdsSyncService.syncEnhancedAnalytics(false);
      logger.info('[CRON] Sync enhanced analytics nocturno completado');
    } catch (error: any) {
      logger.error('[CRON] Error en sync enhanced analytics nocturno: ' + error.message);
    }
  });

  logger.info('Analytics distribuido registrado: 6AM–8PM (un método c/2h) + barrido completo 11PM');

  // ─── Auction Insights: sync semanal (domingos 5 AM) ──────────────────────
  cron.schedule('0 5 * * 0', async () => {
    logger.info('[CRON] Iniciando sync semanal de Auction Insights...');
    try {
      await googleAdsSyncService.syncAuctionInsights();
      logger.info('[CRON] Sync Auction Insights completado');
    } catch (error: any) {
      logger.error('[CRON] Error en sync Auction Insights: ' + error.message);
    }
  });

  logger.info('Auction Insights cron registrado: semanal los domingos a las 5AM');
}
