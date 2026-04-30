import { EventEmitter } from 'events';

// google-ads-api usa gRPC que abre conexiones TLS concurrentes.
// Cada conexión agrega listeners al mismo socket, superando el límite por defecto (10).
// Esto NO es un memory leak real — es comportamiento normal del cliente gRPC.
EventEmitter.defaultMaxListeners = 100;

// Suprime el warning de MaxListeners para sockets TLS del cliente gRPC.
// El warning es inofensivo: no hay fuga de memoria real.
const _originalWarning = process.listeners('warning');
process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.name === 'MaxListenersExceededWarning') return;
  process.stderr.write(`WARNING: ${warning.message}\n`);
});

import express from 'express';
import { env } from './config/environment';
import { pool, query } from './config/database';
import { logger } from './utils/logger.util';
import { registerCronJobs } from './jobs/cron';
import { googleAdsSyncService } from './services/google-ads-sync.service';

const app = express();
app.use(express.json());

// Conteo de filas para todas las tablas de Google Ads
async function getAllTableCounts() {
  const tables = [
    { key: 'campaigns',                       table: 'campaigns' },
    { key: 'snapshots_diarios',               table: 'google_ads_snapshots' },
    { key: 'keywords',                        table: 'google_ads_keyword_snapshots' },
    { key: 'dispositivos',                    table: 'google_ads_device_snapshots' },
    { key: 'geografia',                       table: 'google_ads_geo_snapshots' },
    { key: 'ubicaciones_usuario',             table: 'google_ads_location_snapshots' },
    { key: 'horario',                         table: 'google_ads_hourly_snapshots' },
    { key: 'terminos_busqueda',               table: 'google_ads_search_term_snapshots' },
    { key: 'anuncios',                        table: 'google_ads_ad_snapshots' },
    { key: 'subasta_competitiva',             table: 'google_ads_auction_insights' },
    { key: 'demografia',                      table: 'google_ads_demographics_snapshots' },
    { key: 'assets',                          table: 'google_ads_asset_snapshots' },
    { key: 'cuentas_facturacion',             table: 'google_ads_billing_accounts' },
    { key: 'cargos_cuenta',                   table: 'google_ads_account_charges' },
    { key: 'historial_facturacion',           table: 'google_ads_billing_history' },
    { key: 'recargas',                        table: 'google_ads_recharges' },
  ];
  const counts: Record<string, number> = {};
  for (const { key, table } of tables) {
    const r = await query(`SELECT COUNT(*) AS n FROM ${table}`);
    counts[key] = parseInt(r.rows[0].n, 10);
  }
  return counts;
}

// ─── Parsea el modo de fecha desde query params ───────────────────────────────
// ?historical=true → ENTRE 2018-01-01 y hoy (todo el histórico disponible)
// ?backfill=true   → LAST_30_DAYS (backfill normal)
// (ninguno)        → LAST_14_DAYS (sync incremental)
function parseDateMode(query: Record<string, any>): boolean | string {
  if (query.historical === 'true') {
    const today = new Date().toISOString().slice(0, 10);
    return `segments.date BETWEEN '2018-01-01' AND '${today}'`;
  }
  return query.backfill === 'true';
}

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'google-ads-collector',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ─── Status: conteo de filas en todas las tablas ──────────────────────────────
app.get('/status', async (_req, res) => {
  try {
    const counts = await getAllTableCounts();
    const lastSync = await query(`SELECT MAX(last_synced_at) AS ts FROM campaigns`);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    res.json({
      rateLimitActive: googleAdsSyncService.isRateLimited(),
      lastCampaignSync: lastSync.rows[0]?.ts || null,
      totalRows: total,
      tableCounts: counts,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Reset rate limit ─────────────────────────────────────────────────────────
app.post('/reset-rate-limit', (_req, res) => {
  googleAdsSyncService.clearRateLimit();
  res.json({ ok: true, message: 'Rate limit limpiado. Puede volver a sincronizar.' });
});

// ─── Sync: campañas + snapshots diarios ──────────────────────────────────────
app.post('/sync/campaigns', async (_req, res) => {
  logger.info('[SYNC] Campaña sync iniciado...');
  const t = Date.now();
  try {
    await googleAdsSyncService.syncAllCampaigns(false);
    const elapsed = ((Date.now() - t) / 1000).toFixed(1);
    const [c, s] = await Promise.all([
      query(`SELECT COUNT(*) AS n FROM campaigns`),
      query(`SELECT COUNT(*) AS n FROM google_ads_snapshots`),
    ]);
    res.json({
      ok: true, elapsed: `${elapsed}s`,
      campaigns: parseInt(c.rows[0].n, 10),
      snapshots_diarios: parseInt(s.rows[0].n, 10),
    });
  } catch (error: any) {
    logger.error('[SYNC] campaigns error: ' + error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ─── Sync: facturación completa ───────────────────────────────────────────────
app.post('/sync/billing', async (_req, res) => {
  logger.info('[SYNC] Billing sync iniciado...');
  const t = Date.now();
  try {
    await googleAdsSyncService.syncBillingAccounts();
    await googleAdsSyncService.syncAccountCharges();
    await googleAdsSyncService.syncRecharges();
    await googleAdsSyncService.syncBillingHistory();
    const elapsed = ((Date.now() - t) / 1000).toFixed(1);
    const [a, b, c, d] = await Promise.all([
      query(`SELECT COUNT(*) AS n FROM google_ads_billing_accounts`),
      query(`SELECT COUNT(*) AS n FROM google_ads_account_charges`),
      query(`SELECT COUNT(*) AS n FROM google_ads_recharges`),
      query(`SELECT COUNT(*) AS n FROM google_ads_billing_history`),
    ]);
    res.json({
      ok: true, elapsed: `${elapsed}s`,
      cuentas_facturacion: parseInt(a.rows[0].n, 10),
      cargos_cuenta:       parseInt(b.rows[0].n, 10),
      recargas:            parseInt(c.rows[0].n, 10),
      historial_facturas:  parseInt(d.rows[0].n, 10),
    });
  } catch (error: any) {
    logger.error('[SYNC] billing error: ' + error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ─── Sync: analytics avanzado ─────────────────────────────────────────────────
// Incluye: keywords, dispositivos, geografía, ubicaciones, horario,
//          términos búsqueda, anuncios, demografía, assets
// ?historical=true → TODO el histórico desde 2018-01-01 hasta hoy (MÁXIMO)
// ?backfill=true   → últimos 30 días
// Sin parámetro    → últimos 14 días (sync incremental)
app.post('/sync/enhanced', async (req, res) => {
  const dateMode = parseDateMode(req.query as any);
  const modeLabel = typeof dateMode === 'string' ? 'HISTÓRICO completo' : dateMode ? '30 días' : '14 días';
  logger.info(`[SYNC] Enhanced analytics sync iniciado... (${modeLabel})`);
  const t = Date.now();
  try {
    await googleAdsSyncService.syncEnhancedAnalytics(dateMode);
    const elapsed = ((Date.now() - t) / 1000).toFixed(1);
    const [k, d, g, loc, h, st, ad, dem, ast] = await Promise.all([
      query(`SELECT COUNT(*) AS n FROM google_ads_keyword_snapshots`),
      query(`SELECT COUNT(*) AS n FROM google_ads_device_snapshots`),
      query(`SELECT COUNT(*) AS n FROM google_ads_geo_snapshots`),
      query(`SELECT COUNT(*) AS n FROM google_ads_location_snapshots`),
      query(`SELECT COUNT(*) AS n FROM google_ads_hourly_snapshots`),
      query(`SELECT COUNT(*) AS n FROM google_ads_search_term_snapshots`),
      query(`SELECT COUNT(*) AS n FROM google_ads_ad_snapshots`),
      query(`SELECT COUNT(*) AS n FROM google_ads_demographics_snapshots`),
      query(`SELECT COUNT(*) AS n FROM google_ads_asset_snapshots`),
    ]);
    res.json({
      ok: true, elapsed: `${elapsed}s`, mode: modeLabel,
      keywords:            parseInt(k.rows[0].n, 10),
      dispositivos:        parseInt(d.rows[0].n, 10),
      geografia:           parseInt(g.rows[0].n, 10),
      ubicaciones_usuario: parseInt(loc.rows[0].n, 10),
      horario:             parseInt(h.rows[0].n, 10),
      terminos_busqueda:   parseInt(st.rows[0].n, 10),
      anuncios:            parseInt(ad.rows[0].n, 10),
      demografia:          parseInt(dem.rows[0].n, 10),
      assets:              parseInt(ast.rows[0].n, 10),
    });
  } catch (error: any) {
    logger.error('[SYNC] enhanced error: ' + error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ─── Sync: subasta competitiva ────────────────────────────────────────────────
app.post('/sync/auction', async (_req, res) => {
  logger.info('[SYNC] Auction insights sync iniciado...');
  const t = Date.now();
  try {
    await googleAdsSyncService.syncAuctionInsights();
    const elapsed = ((Date.now() - t) / 1000).toFixed(1);
    const r = await query(`SELECT COUNT(*) AS n FROM google_ads_auction_insights`);
    res.json({ ok: true, elapsed: `${elapsed}s`, subasta_competitiva: parseInt(r.rows[0].n, 10) });
  } catch (error: any) {
    logger.error('[SYNC] auction error: ' + error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ─── Sync: COMPLETO — todos los datos de Google Ads ──────────────────────────
// Sincroniza TODO: campañas, facturación, keywords, dispositivos, geografía,
//   ubicaciones, horario, términos búsqueda, anuncios, demografía, assets,
//   subasta competitiva.
//
// ?historical=true → analytics con TODO el histórico desde 2018-01-01 (RECOMENDADO primera vez)
// ?backfill=true   → analytics con últimos 30 días
// Sin parámetro    → analytics con últimos 14 días (sync incremental)
//
// ADVERTENCIA: historical puede tardar 1-3 horas con muchas cuentas.
// Configurar timeout en Postman: Settings → Request timeout → 0 (sin límite)
app.post('/sync/all', async (req, res) => {
  const dateMode = parseDateMode(req.query as any);
  const modeLabel = typeof dateMode === 'string' ? 'HISTÓRICO completo desde 2018' : dateMode ? '30 días' : '14 días';
  logger.info(`[SYNC] Sync COMPLETO iniciado... (${modeLabel})`);
  logger.info('[SYNC] Ver progreso en esta consola.');
  const t = Date.now();
  try {
    await googleAdsSyncService.syncAll(dateMode);
    const elapsed = ((Date.now() - t) / 1000).toFixed(1);
    const counts = await getAllTableCounts();
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    logger.info(`[SYNC] Sync COMPLETO finalizado en ${elapsed}s — ${total} filas totales`);
    res.json({ ok: true, elapsed: `${elapsed}s`, mode: modeLabel, totalRows: total, tableCounts: counts });
  } catch (error: any) {
    logger.error('[SYNC] sync/all error: ' + error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ─── Inicio ───────────────────────────────────────────────────────────────────
async function start() {
  try {
    await pool.query('SELECT 1');
    logger.info(`[DB] Conectado: ${env.db.host}:${env.db.port}/${env.db.name}`);
  } catch (error: any) {
    logger.error('[DB] No se pudo conectar a PostgreSQL: ' + error.message);
    process.exit(1);
  }

  registerCronJobs();

  app.listen(env.port, () => {
    logger.info(`[SERVER] google-ads-collector puerto ${env.port}`);
    logger.info('[SERVER]   GET  /health');
    logger.info('[SERVER]   GET  /status');
    logger.info('[SERVER]   POST /sync/campaigns                    ← campañas + snapshots diarios');
    logger.info('[SERVER]   POST /sync/billing                      ← facturación completa');
    logger.info('[SERVER]   POST /sync/enhanced                     ← keywords/geo/horario/anuncios/etc (14 días)');
    logger.info('[SERVER]   POST /sync/enhanced?backfill=true       ← igual pero 30 días');
    logger.info('[SERVER]   POST /sync/enhanced?historical=true     ← igual pero TODO el histórico ← PRIMERA VEZ');
    logger.info('[SERVER]   POST /sync/auction                      ← datos de subasta competitiva');
    logger.info('[SERVER]   POST /sync/all                          ← TODO (14 días)');
    logger.info('[SERVER]   POST /sync/all?backfill=true            ← TODO + 30 días');
    logger.info('[SERVER]   POST /sync/all?historical=true          ← TODO + histórico completo ← PRIMERA VEZ');
    logger.info('[SERVER]   POST /reset-rate-limit');
  });
}

start();
