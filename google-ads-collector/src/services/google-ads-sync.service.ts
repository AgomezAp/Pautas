/**
 * ══════════════════════════════════════════════════════════════════════
 *  Google Ads Sync Service — Sincronización con la API de Google Ads
 * ══════════════════════════════════════════════════════════════════════
 *
 *  PROPÓSITO:
 *    Sincroniza datos de la API de Google Ads a la BD PostgreSQL local.
 *    Maneja campañas, keywords, dispositivos, geo, horario, términos
 *    de búsqueda, anuncios, demografía, assets, billing e invoices.
 *
 *  TABLAS QUE ESCRIBE:
 *    campaigns, google_ads_snapshots, google_ads_keyword_snapshots,
 *    google_ads_device_snapshots, google_ads_geo_snapshots,
 *    google_ads_hourly_snapshots, google_ads_search_term_snapshots,
 *    google_ads_ad_snapshots, google_ads_auction_insights,
 *    google_ads_demographics_snapshots, google_ads_asset_snapshots,
 *    google_ads_billing_accounts, google_ads_account_charges,
 *    google_ads_billing_history, google_ads_recharges
 *
 *  CONTROL DE CONCURRENCIA:
 *    ─ CONCURRENCY_LIMIT = 2 cuentas en paralelo (evita rate limit)
 *    ─ 1 segundo de delay entre iteraciones
 *    ─ Detección automática de rate limit (RESOURCE_EXHAUSTED)
 *    ─ Cooldown configurable (default 1 hora)
 *
 *  FLUJO DE SYNC COMPLETO (syncAll):
 *    1. syncAllCampaigns() → campañas + snapshots diarios (14 días)
 *    2. syncBillingAccounts() → cuentas de facturación
 *    3. syncAccountCharges() → cargos/presupuestos
 *    4. syncRecharges() → recargas (proposals de presupuesto)
 *    5. syncBillingHistory() → invoices del último año fiscal
 *    6. syncEnhancedAnalytics() → keywords, devices, geo, hourly,
 *       searchTerms, adPerformance, demographics, assets
 * ══════════════════════════════════════════════════════════════════════
 */

import { env } from '../config/environment';
import { query } from '../config/database';
import { logger } from '../utils/logger.util';

/**
 * Mapa de códigos de estado numéricos de Google Ads → cadena legible.
 * La API devuelve enteros (0-4); los convertimos para almacenar en BD.
 *  0 = UNSPECIFIED | 1 = UNKNOWN | 2 = ENABLED | 3 = PAUSED | 4 = REMOVED
 */
const STATUS_MAP: Record<number, string> = {
  0: 'UNSPECIFIED',
  1: 'UNKNOWN',
  2: 'ENABLED',
  3: 'PAUSED',
  4: 'REMOVED',
};

/**
 * Patrones para detectar el país a partir del nombre de la cuenta de Google Ads.
 * Ej: "ACME - COLOMBIA SAS" → detecta "COLOMBIA" → código "CO".
 * Se usa en {@link GoogleAdsSyncService.detectCountryCode} para asignar country_id.
 */
const COUNTRY_PATTERNS: Record<string, string> = {
  'COLOMBIA': 'CO',
  'MEXICO': 'MX',
  'PERU': 'PE',
  'CHILE': 'CL',
  'ECUADOR': 'EC',
  'PANAMA': 'PA',
  'BOLIVIA': 'BO',
  'ESPAÑA': 'ES',
};

/**
 * Límite de concurrencia para llamadas paralelas a la API de Google Ads.
 * Se mantiene bajo (2) para evitar errores RESOURCE_EXHAUSTED / 429.
 * Cada worker añade un delay de 1 segundo entre cuentas procesadas.
 */
const CONCURRENCY_LIMIT = 2;

export class GoogleAdsSyncService {
  /** Instancia singleton del cliente GoogleAdsApi (se crea lazily en getApi()) */
  private client: any = null;

  /** Cache de cuentas client (no-manager) descubiertas bajo el MCC */
  private cachedClientAccounts: { id: string; name: string }[] | null = null;

  /** Timestamp (ms) de la última vez que se pobló cachedClientAccounts */
  private cacheTimestamp = 0;

  /** Tiempo de vida del cache de cuentas: 30 minutos en milisegundos */
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  /**
   * Inicializa el cliente de Google Ads API de forma lazy (singleton).
   *
   * Usa las credenciales de `env.googleAds` (developerToken, clientId, clientSecret).
   * Si las credenciales no están configuradas, retorna null y loguea un warning.
   * El import de 'google-ads-api' es dinámico para evitar errores si el paquete
   * no está instalado.
   *
   * @returns {Promise<any>} Instancia de GoogleAdsApi, o null si no está configurado.
   */
  private async getApi(): Promise<any> {
    if (this.client) return this.client;

    if (!env.googleAds.developerToken || !env.googleAds.clientId) {
      logger.warn('Google Ads API not configured. Skipping sync.');
      return null;
    }

    try {
      const { GoogleAdsApi } = await import('google-ads-api');

      this.client = new GoogleAdsApi({
        client_id: env.googleAds.clientId,
        client_secret: env.googleAds.clientSecret,
        developer_token: env.googleAds.developerToken,
      });

      return this.client;
    } catch (error: any) {
      logger.error(`Failed to initialize Google Ads client: ${error.message}`);
      return null;
    }
  }

  /**
   * Crea un objeto Customer autenticado para ejecutar queries GAQL.
   *
   * @param api           - Instancia de GoogleAdsApi (obtenida de getApi())
   * @param customerId    - ID de la cuenta Google Ads (ej: "1234567890")
   * @param loginCustomerId - (Opcional) ID del MCC que autoriza el acceso
   * @returns Objeto Customer con método .query() para ejecutar GAQL
   */
  private getCustomer(api: any, customerId: string, loginCustomerId?: string): any {
    const opts: any = {
      customer_id: customerId,
      refresh_token: env.googleAds.refreshToken,
    };
    if (loginCustomerId) {
      opts.login_customer_id = loginCustomerId;
    }
    return api.Customer(opts);
  }

  /**
   * Descubre todas las cuentas client (no-manager) bajo el MCC.
   *
   * Ejecuta la query GAQL:
   *   SELECT customer_client.id, customer_client.descriptive_name,
   *          customer_client.manager, customer_client.status
   *   FROM customer_client
   *   WHERE customer_client.manager = FALSE AND customer_client.status = 'ENABLED'
   *
   * Los resultados se cachean por 30 minutos (CACHE_TTL) para reducir
   * llamadas redundantes a la API durante un ciclo de sync completo.
   *
   * @returns {Promise<{id: string, name: string}[]>} Array de cuentas con id y nombre descriptivo.
   */
  private async getClientAccounts(): Promise<{ id: string; name: string }[]> {
    if (this.cachedClientAccounts && (Date.now() - this.cacheTimestamp) < this.CACHE_TTL) {
      return this.cachedClientAccounts;
    }

    const api = await this.getApi();
    if (!api) return [];

    const managerId = env.googleAds.managerAccountId;

    try {
      const manager = this.getCustomer(api, managerId);
      const results = await manager.query(
        "SELECT customer_client.id, customer_client.descriptive_name, customer_client.manager, customer_client.status FROM customer_client WHERE customer_client.manager = FALSE AND customer_client.status = 'ENABLED'"
      );
      const accounts = results.map((r: any) => ({
        id: String(r.customer_client.id),
        name: r.customer_client.descriptive_name || '',
      }));
      this.cachedClientAccounts = accounts;
      this.cacheTimestamp = Date.now();
      logger.info(`Found ${accounts.length} client accounts under MCC`);
      return accounts;
    } catch (error: any) {
      logger.error(`Could not query MCC for clients: ${error.errors?.[0]?.message || error.message}`);
      return [];
    }
  }

  /**
   * Detecta el código ISO de país a partir del nombre de una cuenta o campaña.
   *
   * Compara el nombre (en mayúsculas) contra COUNTRY_PATTERNS.
   * Ej: "MiEmpresa COLOMBIA" → "CO", "Ventas PERU" → "PE".
   *
   * @param name - Nombre de la cuenta o campaña de Google Ads
   * @returns Código ISO de 2 letras (ej: "CO", "MX") o null si no se detecta país.
   */
  private detectCountryCode(name: string): string | null {
    const upper = name.toUpperCase();
    for (const [pattern, code] of Object.entries(COUNTRY_PATTERNS)) {
      if (upper.includes(pattern)) return code;
    }
    return null;
  }

  // ── Control de Rate Limit ──────────────────────────────────────────
  // Cuando la API responde RESOURCE_EXHAUSTED (429), se marca rateLimitHit = true
  // y se detiene el procesamiento de nuevas cuentas. El flag persiste entre métodos
  // de sync para que, si keywords hace rate limit, devices/geo no intenten más.
  /** Bandera: true cuando se detectó rate limit. No se resetea entre métodos. */
  private rateLimitHit = false;
  /** Timestamp (ms) en que expira el rate limit. 0 = sin fecha definida. */
  private rateLimitResetAt = 0;

  /**
   * Verifica si estamos actualmente bajo rate limit de la API.
   * Si el período de espera ya expiró, limpia el flag automáticamente.
   *
   * @returns true si estamos en rate limit activo, false si podemos continuar.
   */
  isRateLimited(): boolean {
    if (!this.rateLimitHit) return false;
    // Auto-clear if the retry period has passed
    if (this.rateLimitResetAt && Date.now() > this.rateLimitResetAt) {
      this.rateLimitHit = false;
      this.rateLimitResetAt = 0;
      logger.info('Rate limit period expired, resuming API calls');
      return false;
    }
    return true;
  }

  /**
   * Marca el servicio como rate-limited por la API de Google Ads.
   * Si se detecta "Retry in X seconds" en el error, configura un cooldown automático.
   * Por defecto el cooldown es de 1 hora (3600 segundos).
   *
   * @param retryAfterSecs - Segundos de espera sugeridos por la API (opcional)
   */
  private markRateLimited(retryAfterSecs?: number): void {
    this.rateLimitHit = true;
    if (retryAfterSecs) {
      this.rateLimitResetAt = Date.now() + retryAfterSecs * 1000;
      logger.error(`Rate limit hit. Will auto-clear in ${Math.round(retryAfterSecs / 60)} minutes`);
    }
  }

  clearRateLimit(): void {
    this.rateLimitHit = false;
    this.rateLimitResetAt = 0;
    logger.info('Rate limit flag cleared manually');
  }

  /**
   * Pool de concurrencia limitada para procesar cuentas en paralelo.
   *
   * Crea `limit` workers que consumen del array `items` secuencialmente.
   * Si se detecta rate limit (rateLimitHit), todos los workers se detienen.
   * Incluye un delay de 1 segundo entre iteraciones para evitar ráfagas.
   *
   * Ejemplo con 10 cuentas y limit=2:
   *   Worker A: cuenta[0] → delay → cuenta[2] → delay → cuenta[4] → ...
   *   Worker B: cuenta[1] → delay → cuenta[3] → delay → cuenta[5] → ...
   *
   * NOTA: No resetea rateLimitHit internamente; el flag persiste entre
   * llamadas a distintos métodos de sync.
   *
   * @template T - Tipo de los items a procesar (generalmente {id, name})
   * @param items - Array de elementos a procesar (cuentas de Google Ads)
   * @param fn    - Función async que procesa cada item
   * @param limit - Máximo de workers concurrentes (default: 2)
   */
  private async runWithConcurrency<T>(
    items: T[],
    fn: (item: T) => Promise<void>,
    limit: number = 2,
  ): Promise<void> {
    // Do NOT reset rateLimitHit here — it must persist across sync methods
    let index = 0;
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const run = async () => {
      while (index < items.length && !this.rateLimitHit) {
        const i = index++;
        await fn(items[i]);
        // Small delay between accounts to avoid bursting API calls
        if (index < items.length) await delay(1000);
      }
    };
    const workers = Array.from({ length: Math.min(limit, items.length) }, () => run());
    await Promise.all(workers);
  }

  // ════════════════════════════════════════════════════════════════════
  // 1. Sync de campañas — Método principal de sincronización
  // ════════════════════════════════════════════════════════════════════

  /**
   * Sincroniza todas las campañas de Google Ads y sus métricas diarias.
   *
   * FLUJO:
   *   1. Descubre cuentas client bajo el MCC (getClientAccounts)
   *   2. Si activeOnly=true, filtra cuentas que empiecen con "PAUSADA"
   *   3. Carga mapa de países (countries) y campañas existentes (campaigns)
   *   4. Por cada cuenta (con concurrencia limitada):
   *      a. Query GAQL: todas las campañas no-REMOVED (sin filtro de fecha)
   *      b. Query GAQL: métricas de LAST_14_DAYS (conversions, cost, clicks, etc.)
   *      c. Detecta país por nombre de cuenta y nombre de campaña
   *      d. INSERT o UPDATE en tabla `campaigns`
   *      e. UPSERT snapshots diarios en `google_ads_snapshots`
   *         (ON CONFLICT campaign_id + snapshot_date)
   *
   * QUERIES GAQL:
   *   - SELECT campaign.id, name, status, channel_type, budget FROM campaign
   *   - SELECT campaign.id, segments.date, metrics.* FROM campaign WHERE LAST_14_DAYS
   *
   * TABLAS AFECTADAS:
   *   - campaigns: INSERT (nuevas) o UPDATE (existentes)
   *   - google_ads_snapshots: UPSERT por (campaign_id, snapshot_date)
   *
   * @param activeOnly - Si true, excluye cuentas "PAUSADA" (para syncs horarios rápidos)
   */
  async syncAllCampaigns(activeOnly = false): Promise<void> {
    const api = await this.getApi();
    if (!api) {
      logger.warn('Google Ads sync skipped: client not configured');
      return;
    }

    logger.info('Starting Google Ads sync — discovering accounts and campaigns...');

    try {
      let clientAccounts = await this.getClientAccounts();
      if (clientAccounts.length === 0) {
        logger.warn('No client accounts found');
        return;
      }

      // Skip PAUSADA accounts during hourly syncs to reduce API calls
      if (activeOnly) {
        const before = clientAccounts.length;
        clientAccounts = clientAccounts.filter((a: any) => !a.name.toUpperCase().startsWith('PAUSADA'));
        logger.info('Active-only sync: ' + clientAccounts.length + ' accounts (' + (before - clientAccounts.length) + ' PAUSADA skipped)');
      }

      const today = new Date().toISOString().split('T')[0];
      const managerId = env.googleAds.managerAccountId;

      // Load country map: code -> id
      const countriesResult = await query(`SELECT id, code FROM countries WHERE is_active = TRUE`);
      const countryMap = new Map<string, number>(countriesResult.rows.map((c: any) => [c.code, c.id]));
      const defaultCountryId = countriesResult.rows[0]?.id || 1;

      // Build map of existing local campaigns
      const existingCampaigns = await query(
        `SELECT id, google_ads_campaign_id FROM campaigns WHERE google_ads_campaign_id IS NOT NULL`
      );
      const campaignMap = new Map(existingCampaigns.rows.map((c: any) => [String(c.google_ads_campaign_id), c.id]));

      let synced = 0;
      let imported = 0;
      let errors = 0;

      await this.runWithConcurrency(clientAccounts, async (account) => {
        const customer = this.getCustomer(api, account.id, managerId);

        try {
          // Step 1: Fetch all campaigns (no date filter)
          const campaignList = await customer.query(`
            SELECT
              campaign.id,
              campaign.name,
              campaign.status,
              campaign.advertising_channel_type,
              campaign.bidding_strategy_type,
              campaign_budget.amount_micros
            FROM campaign
            WHERE campaign.status != 'REMOVED'
          `);

          if (campaignList.length === 0) return;

          // Step 2: Fetch metrics for last 14 days to cover gaps if sync was down
          // Key: "campaignId_date" -> { metrics, date }
          const metricsMultiDay = new Map<string, { metrics: any; date: string }[]>();
          try {
            const metricsResults = await customer.query(`
              SELECT
                campaign.id,
                segments.date,
                metrics.conversions,
                metrics.cost_micros,
                metrics.clicks,
                metrics.impressions,
                metrics.ctr,
                metrics.search_impression_share,
                metrics.search_top_impression_rate,
                metrics.search_absolute_top_impression_rate,
                metrics.search_budget_lost_impression_share,
                metrics.search_rank_lost_impression_share
              FROM campaign
              WHERE segments.date DURING LAST_14_DAYS
            `);
            for (const row of metricsResults) {
              const cId = String(row.campaign.id);
              const segDate = row.segments?.date || today;
              if (!metricsMultiDay.has(cId)) metricsMultiDay.set(cId, []);
              metricsMultiDay.get(cId)!.push({ metrics: row.metrics, date: segDate });
            }
          } catch (metricsError: any) {
            // Metrics may not exist — not critical
          }

          // Detect country from account name
          const countryCode = this.detectCountryCode(account.name);
          const countryId = countryCode ? (countryMap.get(countryCode) || defaultCountryId) : defaultCountryId;

          for (const row of campaignList) {
            const adsCampaignId = String(row.campaign.id);
            let localCampaignId = campaignMap.get(adsCampaignId);

            const budgetMicros = row.campaign_budget?.amount_micros || 0;
            const dailyBudget = budgetMicros / 1_000_000;
            const campaignName = row.campaign?.name || `Campaign ${adsCampaignId}`;
            const statusCode = row.campaign?.status;
            const statusStr = STATUS_MAP[statusCode] || String(statusCode);
            const channelType = row.campaign?.advertising_channel_type || null;
            const biddingStrategyType = row.campaign?.bidding_strategy_type || null;
            const campaignMetrics = metricsMultiDay.get(adsCampaignId) || [];
            // Use today's metrics for remaining_budget calculation; fallback to most recent
            const todayMetrics = campaignMetrics.find(m => m.date === today)?.metrics;
            const costMicros = todayMetrics?.cost_micros || 0;

            // Also try to detect country from campaign name (more specific)
            const campaignCountryCode = this.detectCountryCode(campaignName);
            const finalCountryId = campaignCountryCode
              ? (countryMap.get(campaignCountryCode) || countryId)
              : countryId;

            if (!localCampaignId) {
              const insertResult = await query(
                `INSERT INTO campaigns (name, google_ads_campaign_id, country_id, campaign_url, ads_status, daily_budget, customer_account_id, customer_account_name, channel_type, bidding_strategy_type, is_active, last_synced_at, created_at, updated_at)
                 VALUES ($1, $2, $3, '', $4, $5, $6, $7, $8, $9, TRUE, NOW(), NOW(), NOW())
                 RETURNING id`,
                [
                  campaignName,
                  adsCampaignId,
                  finalCountryId,
                  statusStr,
                  dailyBudget,
                  account.id,
                  account.name,
                  channelType,
                  biddingStrategyType,
                ]
              );
              localCampaignId = insertResult.rows[0].id;
              campaignMap.set(adsCampaignId, localCampaignId);
              imported++;
            } else {
              await query(
                `UPDATE campaigns SET
                  name = $1,
                  ads_status = $2,
                  daily_budget = $3,
                  country_id = $4,
                  customer_account_id = $5,
                  customer_account_name = $6,
                  channel_type = $7,
                  bidding_strategy_type = $8,
                  last_synced_at = NOW(),
                  updated_at = NOW()
                WHERE id = $9`,
                [
                  campaignName,
                  statusStr,
                  dailyBudget,
                  finalCountryId,
                  account.id,
                  account.name,
                  channelType,
                  biddingStrategyType,
                  localCampaignId,
                ]
              );
            }

            // Insert snapshot for each day with metrics (last 3 days)
            for (const { metrics: dayMetrics, date: snapshotDate } of campaignMetrics) {
              const dayCostMicros = dayMetrics?.cost_micros || 0;
              await query(
                `INSERT INTO google_ads_snapshots
                  (campaign_id, snapshot_date, conversions, status, remaining_budget, cost, clicks, impressions, ctr, daily_budget,
                   search_impression_share, search_top_impression_rate, search_abs_top_impression_rate, search_budget_lost_is, search_rank_lost_is, fetched_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
                 ON CONFLICT (campaign_id, snapshot_date)
                 DO UPDATE SET
                  conversions = EXCLUDED.conversions,
                  status = EXCLUDED.status,
                  remaining_budget = EXCLUDED.remaining_budget,
                  cost = EXCLUDED.cost,
                  clicks = EXCLUDED.clicks,
                  impressions = EXCLUDED.impressions,
                  ctr = EXCLUDED.ctr,
                  daily_budget = EXCLUDED.daily_budget,
                  search_impression_share = EXCLUDED.search_impression_share,
                  search_top_impression_rate = EXCLUDED.search_top_impression_rate,
                  search_abs_top_impression_rate = EXCLUDED.search_abs_top_impression_rate,
                  search_budget_lost_is = EXCLUDED.search_budget_lost_is,
                  search_rank_lost_is = EXCLUDED.search_rank_lost_is,
                  fetched_at = NOW()`,
                [
                  localCampaignId,
                  snapshotDate,
                  dayMetrics?.conversions || 0,
                  statusStr,
                  (budgetMicros - dayCostMicros) / 1_000_000,
                  dayCostMicros / 1_000_000,
                  dayMetrics?.clicks || 0,
                  dayMetrics?.impressions || 0,
                  dayMetrics?.ctr || 0,
                  dailyBudget,
                  dayMetrics?.search_impression_share || null,
                  dayMetrics?.search_top_impression_rate || null,
                  dayMetrics?.search_absolute_top_impression_rate || null,
                  dayMetrics?.search_budget_lost_impression_share || null,
                  dayMetrics?.search_rank_lost_impression_share || null,
                ]
              );
            }
            synced++;
          }
        } catch (accountError: any) {
          const errorMsg = accountError.errors?.[0]?.message || accountError.message || '';
          if (errorMsg.includes('Too many requests') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
            const retryMatch = errorMsg.match(/Retry in (\d+) seconds/);
            this.markRateLimited(retryMatch ? parseInt(retryMatch[1]) : 3600);
            logger.error('Google Ads API rate limit reached — stopping sync to avoid further errors');
          } else {
            errors++;
            logger.warn('Error syncing account ' + account.id + ' (' + account.name + '): ' + errorMsg);
          }
        }
      }, CONCURRENCY_LIMIT);

      logger.info(`Google Ads sync complete: ${synced} campaigns updated, ${imported} imported, ${errors} account errors`);
    } catch (error: any) {
      logger.error(`Google Ads sync failed: ${error.message}`);
      throw error;
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // 2. Sync de cuentas de facturación
  // ════════════════════════════════════════════════════════════════════

  /**
   * Sincroniza la configuración de facturación (billing setup) de cada cuenta.
   *
   * QUERY GAQL:
   *   SELECT billing_setup.id, billing_setup.status,
   *          billing_setup.payments_account_info.payments_account_id,
   *          billing_setup.payments_account_info.payments_account_name,
   *          billing_setup.payments_account_info.payments_profile_id,
   *          billing_setup.payments_account_info.payments_profile_name
   *   FROM billing_setup
   *
   * Además obtiene el currency_code de la cuenta (SELECT customer.currency_code).
   *
   * TABLA AFECTADA:
   *   google_ads_billing_accounts — UPSERT por billing_id (payments_account_id)
   *
   * Campos sincronizados: billing_id, name, status, currency_code,
   *   payments_profile_name, customer_account_id, customer_account_name
   */
  async syncBillingAccounts(): Promise<void> {
    const api = await this.getApi();
    if (!api) return;

    logger.info('Syncing Google Ads billing accounts...');

    try {
      const clientAccounts = await this.getClientAccounts();
      const managerId = env.googleAds.managerAccountId;
      let synced = 0;

      await this.runWithConcurrency(clientAccounts, async (account) => {
        const customer = this.getCustomer(api, account.id, managerId);
        try {
          // Get billing setup with payment profile details
          const results = await customer.query(`
            SELECT
              billing_setup.id,
              billing_setup.status,
              billing_setup.payments_account_info.payments_account_id,
              billing_setup.payments_account_info.payments_account_name,
              billing_setup.payments_account_info.payments_profile_id,
              billing_setup.payments_account_info.payments_profile_name
            FROM billing_setup
          `);

          // Get account currency
          let currencyCode = 'USD';
          try {
            const custInfo = await customer.query(`SELECT customer.currency_code FROM customer`);
            if (custInfo.length > 0) {
              currencyCode = custInfo[0].customer.currency_code || 'USD';
            }
          } catch (_) { /* ignore */ }

          for (const row of results) {
            const paymentsAccountId = row.billing_setup?.payments_account_info?.payments_account_id;
            if (!paymentsAccountId) continue;

            const billingStatus = STATUS_MAP[row.billing_setup?.status] || String(row.billing_setup?.status || 'UNKNOWN');

            await query(
              `INSERT INTO google_ads_billing_accounts
                (billing_id, name, status, currency_code, payments_profile_name, customer_account_id, customer_account_name, last_synced_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
               ON CONFLICT (billing_id) DO UPDATE SET
                name = EXCLUDED.name,
                status = EXCLUDED.status,
                currency_code = EXCLUDED.currency_code,
                payments_profile_name = EXCLUDED.payments_profile_name,
                customer_account_id = EXCLUDED.customer_account_id,
                customer_account_name = EXCLUDED.customer_account_name,
                last_synced_at = NOW()`,
              [
                paymentsAccountId,
                row.billing_setup?.payments_account_info?.payments_account_name || 'N/A',
                billingStatus,
                currencyCode,
                row.billing_setup?.payments_account_info?.payments_profile_name || null,
                account.id,
                account.name,
              ]
            );
            synced++;
          }
        } catch (accountError: any) {
          // Billing setup may not exist for all accounts
        }
      }, CONCURRENCY_LIMIT);

      logger.info(`Billing accounts synced: ${synced}`);
    } catch (error: any) {
      logger.error(`Billing accounts sync failed: ${error.message}`);
      throw error;
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // 3. Sync de cargos/presupuestos de cuenta (account budgets)
  // ════════════════════════════════════════════════════════════════════

  /**
   * Sincroniza las transacciones de presupuesto (account_budget) por cuenta.
   *
   * FLUJO:
   *   1. Por cada cuenta, obtiene billing_setup y currency_code
   *   2. Query GAQL: SELECT account_budget.id, name, status, dates, adjustments, served
   *   3. Busca el billing_account_id local en google_ads_billing_accounts
   *   4. UPSERT en google_ads_account_charges
   *
   * QUERY GAQL:
   *   SELECT account_budget.id, account_budget.name, account_budget.status,
   *          proposed_start/end_date, approved_start/end_date,
   *          purchase_order_number, total_adjustments_micros, amount_served_micros
   *   FROM account_budget
   *
   * TABLA AFECTADA:
   *   google_ads_account_charges — UPSERT por (customer_account_id, payments_account_id)
   *
   * NOTA: Los montos vienen en micros (÷ 1,000,000 para valor real).
   *       No todas las cuentas tienen account_budget disponible.
   */
  async syncAccountCharges(): Promise<void> {
    const api = await this.getApi();
    if (!api) return;

    logger.info('Syncing Google Ads account charges...');

    try {
      const clientAccounts = await this.getClientAccounts();
      const managerId = env.googleAds.managerAccountId;
      let synced = 0;

      await this.runWithConcurrency(clientAccounts, async (account) => {
        const customer = this.getCustomer(api, account.id, managerId);
        try {
          // Get billing setup info for this account
          const billingSetup = await customer.query(`
            SELECT
              billing_setup.payments_account_info.payments_account_id,
              billing_setup.payments_account_info.payments_profile_name
            FROM billing_setup
          `);

          let currencyCode = 'USD';
          try {
            const custInfo = await customer.query(`SELECT customer.currency_code FROM customer`);
            if (custInfo.length > 0) currencyCode = custInfo[0].customer.currency_code || 'USD';
          } catch (_) { /* ignore */ }

          const paymentsAccountId = billingSetup[0]?.billing_setup?.payments_account_info?.payments_account_id || null;
          const paymentsProfileName = billingSetup[0]?.billing_setup?.payments_account_info?.payments_profile_name || null;

          // Get account budget info
          const budgets = await customer.query(`
            SELECT
              account_budget.id,
              account_budget.name,
              account_budget.status,
              account_budget.proposed_start_date_time,
              account_budget.approved_start_date_time,
              account_budget.proposed_end_date_time,
              account_budget.approved_end_date_time,
              account_budget.purchase_order_number,
              account_budget.total_adjustments_micros,
              account_budget.amount_served_micros
            FROM account_budget
          `);

          // Lookup billing account id in our DB
          let billingAccountDbId: number | null = null;
          if (paymentsAccountId) {
            const baResult = await query(`SELECT id FROM google_ads_billing_accounts WHERE billing_id = $1`, [paymentsAccountId]);
            billingAccountDbId = baResult.rows[0]?.id || null;
          }

          for (const row of budgets) {
            const budgetStatus = STATUS_MAP[row.account_budget?.status] || String(row.account_budget?.status || 'UNKNOWN');

            await query(
              `INSERT INTO google_ads_account_charges
                (customer_account_id, customer_account_name, billing_account_id, payments_account_id,
                 payments_profile_name, currency_code, budget_name, budget_status,
                 budget_start_date, budget_end_date, purchase_order_number,
                 total_adjustments_micros, amount_served_micros, fetched_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
               ON CONFLICT (customer_account_id, payments_account_id) DO UPDATE SET
                customer_account_name = EXCLUDED.customer_account_name,
                billing_account_id = EXCLUDED.billing_account_id,
                payments_profile_name = EXCLUDED.payments_profile_name,
                currency_code = EXCLUDED.currency_code,
                budget_name = EXCLUDED.budget_name,
                budget_status = EXCLUDED.budget_status,
                budget_start_date = EXCLUDED.budget_start_date,
                budget_end_date = EXCLUDED.budget_end_date,
                purchase_order_number = EXCLUDED.purchase_order_number,
                total_adjustments_micros = EXCLUDED.total_adjustments_micros,
                amount_served_micros = EXCLUDED.amount_served_micros,
                fetched_at = NOW()`,
              [
                account.id,
                account.name,
                billingAccountDbId,
                paymentsAccountId,
                paymentsProfileName,
                currencyCode,
                row.account_budget?.name || null,
                budgetStatus,
                row.account_budget?.approved_start_date_time || row.account_budget?.proposed_start_date_time || null,
                row.account_budget?.approved_end_date_time || row.account_budget?.proposed_end_date_time || null,
                row.account_budget?.purchase_order_number || null,
                row.account_budget?.total_adjustments_micros || 0,
                row.account_budget?.amount_served_micros || 0,
              ]
            );
            synced++;
          }
        } catch (accountError: any) {
          // account_budget may not be available for all accounts
        }
      }, CONCURRENCY_LIMIT);

      logger.info(`Account charges synced: ${synced}`);
    } catch (error: any) {
      logger.error(`Account charges sync failed: ${error.message}`);
      throw error;
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // 4. Sync de historial de facturación (invoices)
  // ════════════════════════════════════════════════════════════════════

  /**
   * Sincroniza las facturas (invoices) del último año fiscal de cada cuenta.
   *
   * QUERY GAQL:
   *   SELECT invoice.id, invoice.issue_date, invoice.due_date,
   *          invoice.subtotal_amount_micros, invoice.tax_amount_micros,
   *          invoice.total_amount_micros, invoice.currency_code,
   *          invoice.type, invoice.pdf_url, invoice.payments_account_id
   *   FROM invoice
   *   WHERE invoice.issue_date DURING LAST_BUSINESS_YEAR
   *
   * TABLA AFECTADA:
   *   google_ads_billing_history — UPSERT por invoice_id
   *
   * Los montos se convierten de micros a unidades reales (÷ 1,000,000).
   * Relaciona cada invoice con su billing_account_id local.
   * No todas las cuentas tienen acceso a invoices.
   */
  async syncBillingHistory(): Promise<void> {
    const api = await this.getApi();
    if (!api) return;

    logger.info('Syncing Google Ads billing history...');

    try {
      const clientAccounts = await this.getClientAccounts();
      const managerId = env.googleAds.managerAccountId;
      let synced = 0;

      await this.runWithConcurrency(clientAccounts, async (account) => {
        const customer = this.getCustomer(api, account.id, managerId);
        try {
          const results = await customer.query(`
            SELECT
              invoice.id,
              invoice.issue_date,
              invoice.due_date,
              invoice.subtotal_amount_micros,
              invoice.tax_amount_micros,
              invoice.total_amount_micros,
              invoice.currency_code,
              invoice.type,
              invoice.pdf_url,
              invoice.payments_account_id
            FROM invoice
            WHERE invoice.issue_date DURING LAST_BUSINESS_YEAR
          `);

          for (const row of results) {
            const billingResult = await query(
              `SELECT id FROM google_ads_billing_accounts WHERE billing_id = $1`,
              [row.invoice?.payments_account_id]
            );
            const billingAccountId = billingResult.rows[0]?.id || null;

            await query(
              `INSERT INTO google_ads_billing_history
                (billing_account_id, invoice_id, issue_date, due_date, subtotal, tax, total, currency_code, status, pdf_url, fetched_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
               ON CONFLICT (invoice_id) DO UPDATE SET
                subtotal = EXCLUDED.subtotal,
                tax = EXCLUDED.tax,
                total = EXCLUDED.total,
                status = EXCLUDED.status,
                pdf_url = EXCLUDED.pdf_url,
                fetched_at = NOW()`,
              [
                billingAccountId,
                row.invoice?.id,
                row.invoice?.issue_date || null,
                row.invoice?.due_date || null,
                (row.invoice?.subtotal_amount_micros || 0) / 1_000_000,
                (row.invoice?.tax_amount_micros || 0) / 1_000_000,
                (row.invoice?.total_amount_micros || 0) / 1_000_000,
                row.invoice?.currency_code || 'USD',
                row.invoice?.type || 'UNKNOWN',
                row.invoice?.pdf_url || null,
              ]
            );
            synced++;
          }
        } catch (accountError: any) {
          // Invoice access may not be available for all accounts — not critical
        }
      }, CONCURRENCY_LIMIT);

      logger.info(`Billing history synced: ${synced} invoices`);
    } catch (error: any) {
      logger.error(`Billing history sync failed: ${error.message}`);
      throw error;
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // 5. Sync de recargas (account_budget_proposal — top-ups individuales)
  // ════════════════════════════════════════════════════════════════════

  /**
   * Sincroniza las recargas de presupuesto (account_budget_proposal) por cuenta.
   *
   * LÓGICA DE CÁLCULO DE MONTO DE RECARGA:
   *   Las proposals de Google Ads indican el spending_limit acumulado, no el delta.
   *   Para obtener el monto de cada recarga, se calcula:
   *     - proposal_type = 2 (CREATE): rechargeAmount = newSpendingLimit
   *     - proposal_type = 3 (UPDATE): rechargeAmount = newSpendingLimit - previousLimit
   *   Las proposals se ordenan por creation_date para mantener el running total correcto.
   *   Se descartan recargas con monto <= 0.
   *
   * QUERY GAQL:
   *   SELECT account_budget_proposal.id, proposal_type, status,
   *          proposed_spending_limit_micros, approved_spending_limit_micros,
   *          creation_date_time, approval_date_time
   *   FROM account_budget_proposal
   *   ORDER BY creation_date_time ASC
   *
   * MODO INCREMENTAL (recentOnly=true):
   *   Carga los proposal_id existentes en BD y los salta durante el insert.
   *   Aún itera TODAS las proposals para calcular correctamente los deltas.
   *
   * TABLA AFECTADA:
   *   google_ads_recharges — UPSERT por proposal_id
   *
   * @param recentOnly - Si true, modo incremental (solo inserta proposals nuevos).
   *                      Si false, rebuild completo.
   */
  async syncRecharges(recentOnly = false): Promise<void> {
    const api = await this.getApi();
    if (!api) return;

    logger.info('Syncing Google Ads recharges...' + (recentOnly ? ' [incremental]' : ' [full rebuild]'));

    try {
      const clientAccounts = await this.getClientAccounts();
      const managerId = env.googleAds.managerAccountId;
      let synced = 0;
      let accountsProcessed = 0;
      let accountErrors = 0;

      // Cache billing info per account
      const billingCache = new Map<string, { paymentsAccountId: string | null; paymentsProfileName: string | null; currencyCode: string }>();

      // For incremental mode, load existing proposal IDs to skip them
      const existingProposalIds = new Set<string>();
      if (recentOnly) {
        const existingResult = await query(`SELECT proposal_id FROM google_ads_recharges`);
        for (const row of existingResult.rows) {
          existingProposalIds.add(row.proposal_id);
        }
        logger.info(`Incremental sync: ${existingProposalIds.size} existing proposals in DB`);
      }

      await this.runWithConcurrency(clientAccounts, async (account) => {
        const customer = this.getCustomer(api, account.id, managerId);
        try {
          // Get billing info (cached)
          let paymentsAccountId: string | null = null;
          let paymentsProfileName: string | null = null;
          let currencyCode = 'USD';

          if (billingCache.has(account.id)) {
            const cached = billingCache.get(account.id)!;
            paymentsAccountId = cached.paymentsAccountId;
            paymentsProfileName = cached.paymentsProfileName;
            currencyCode = cached.currencyCode;
          } else {
            try {
              const billingSetup = await customer.query(`
                SELECT billing_setup.payments_account_info.payments_account_id,
                       billing_setup.payments_account_info.payments_profile_name
                FROM billing_setup
              `);
              paymentsAccountId = billingSetup[0]?.billing_setup?.payments_account_info?.payments_account_id || null;
              paymentsProfileName = billingSetup[0]?.billing_setup?.payments_account_info?.payments_profile_name || null;
            } catch (_) {}
            try {
              const custInfo = await customer.query(`SELECT customer.currency_code FROM customer`);
              if (custInfo.length > 0) currencyCode = custInfo[0].customer.currency_code || 'USD';
            } catch (_) {}
            billingCache.set(account.id, { paymentsAccountId, paymentsProfileName, currencyCode });
          }

          // Query ALL proposals from Google Ads API (sorted by creation date)
          const proposals = await customer.query(`
            SELECT
              account_budget_proposal.id,
              account_budget_proposal.proposal_type,
              account_budget_proposal.status,
              account_budget_proposal.proposed_spending_limit_micros,
              account_budget_proposal.approved_spending_limit_micros,
              account_budget_proposal.creation_date_time,
              account_budget_proposal.approval_date_time
            FROM account_budget_proposal
            ORDER BY account_budget_proposal.creation_date_time ASC
          `);

          if (proposals.length === 0) return;
          accountsProcessed++;

          // Sort by creation date to compute spending deltas properly
          const sorted = [...proposals].sort((a: any, b: any) => {
            const da = a.account_budget_proposal?.creation_date_time || '';
            const db = b.account_budget_proposal?.creation_date_time || '';
            return da.localeCompare(db);
          });

          // Iterate ALL proposals to compute the running spending limit correctly
          // but only INSERT proposals that don't already exist in the DB
          let previousLimit = 0;

          for (const row of sorted) {
            const proposal = row.account_budget_proposal;
            const proposalId = proposal?.id ? String(proposal.id) : null;
            if (!proposalId) continue;

            const proposalType = proposal?.proposal_type || 0;
            const spendingLimitMicros = Number(proposal?.approved_spending_limit_micros || proposal?.proposed_spending_limit_micros || 0);
            const newSpendingLimit = spendingLimitMicros / 1_000_000;

            let rechargeAmount = 0;
            if (proposalType === 2) {
              rechargeAmount = newSpendingLimit;
            } else if (proposalType === 3) {
              rechargeAmount = newSpendingLimit - previousLimit;
            }
            previousLimit = newSpendingLimit;

            // Skip non-positive recharges
            if (rechargeAmount <= 0) continue;

            // In incremental mode, skip proposals already in DB
            if (recentOnly && existingProposalIds.has(proposalId)) continue;

            const rechargeDate = proposal?.approval_date_time || proposal?.creation_date_time || null;

            await query(
              `INSERT INTO google_ads_recharges
                (customer_account_id, customer_account_name, payments_account_id,
                 payments_profile_name, currency_code, recharge_amount, new_spending_limit,
                 proposal_id, proposal_type, recharge_date)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
               ON CONFLICT (proposal_id) DO UPDATE SET
                recharge_amount = EXCLUDED.recharge_amount,
                new_spending_limit = EXCLUDED.new_spending_limit,
                customer_account_name = EXCLUDED.customer_account_name,
                payments_profile_name = EXCLUDED.payments_profile_name,
                fetched_at = NOW()`,
              [
                account.id, account.name, paymentsAccountId,
                paymentsProfileName, currencyCode, rechargeAmount,
                newSpendingLimit, proposalId, proposalType, rechargeDate,
              ]
            );
            synced++;
          }
        } catch (accountError: any) {
          accountErrors++;
          logger.warn(`Recharges sync error for account ${account.id} (${account.name}): ${accountError.message}`);
        }
      }, CONCURRENCY_LIMIT);

      logger.info(`Recharges sync done: ${synced} new/updated, ${accountsProcessed} accounts processed, ${accountErrors} errors`);
    } catch (error: any) {
      logger.error('Recharges sync failed: ' + error.message);
      throw error;
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // 6. Sync completo — Orquestador principal
  // ════════════════════════════════════════════════════════════════════

  /**
   * Orquestador que ejecuta todos los métodos de sync en secuencia.
   *
   * ORDEN DE EJECUCIÓN:
   *   1. syncAllCampaigns()      — Campañas + snapshots de 14 días
   *   2. syncBillingAccounts()    — Cuentas de facturación
   *   3. syncAccountCharges()     — Presupuestos (account_budget)
   *   4. syncRecharges()          — Recargas (budget proposals)
   *   5. syncBillingHistory()     — Invoices del último año fiscal
   *   6. syncEnhancedAnalytics()  — Keywords, devices, geo, hourly,
   *                                  searchTerms, ads, demographics, assets
   *
   * Se ejecuta secuencialmente (no en paralelo) porque cada paso
   * puede depender de datos del anterior (ej: campañas deben existir
   * antes de sincronizar keywords). Además, el rate limit se propaga
   * entre métodos gracias al flag persistente rateLimitHit.
   */
  async syncAll(backfill: boolean | string = false): Promise<void> {
    await this.syncAllCampaigns();
    await this.syncBillingAccounts();
    await this.syncAccountCharges();
    await this.syncRecharges();
    await this.syncBillingHistory();
    await this.syncEnhancedAnalytics(backfill);
    await this.syncAuctionInsights();
  }

  /**
   * Construye el filtro de fecha para GAQL.
   *   - string  → se usa directamente (ej: "segments.date BETWEEN '2020-01-01' AND '2026-04-21'")
   *   - true    → LAST_30_DAYS (backfill normal)
   *   - false   → LAST_14_DAYS (sync incremental)
   */
  private buildDateFilter(backfill: boolean | string): string {
    if (typeof backfill === 'string') return backfill;
    return backfill
      ? 'segments.date DURING LAST_30_DAYS'
      : 'segments.date DURING LAST_14_DAYS';
  }

  // ════════════════════════════════════════════════════════════════════
  // Métodos de consulta — Usados por los endpoints de la API REST
  // ════════════════════════════════════════════════════════════════════

  /**
   * Obtiene el detalle de todas las campañas activas con su último snapshot.
   *
   * Ejecuta un JOIN entre:
   *   - campaigns (c): datos base de la campaña
   *   - countries (co): nombre y código del país
   *   - latest_snapshots (CTE): último snapshot por campaña
   *     (DISTINCT ON campaign_id ORDER BY snapshot_date DESC)
   *
   * Retorna: id, google_ads_campaign_id, name, daily_budget, ads_status,
   *          country_name, conversions, cost, clicks, impressions, ctr,
   *          remaining_budget, snapshot_date
   *
   * @param countryId - (Opcional) Filtra por country_id específico
   * @returns Array de campañas con métricas del último snapshot
   */
  async getCampaignDetails(countryId?: number): Promise<any[]> {
    let sql = `
      WITH latest_snapshots AS (
        SELECT DISTINCT ON (campaign_id)
               campaign_id, snapshot_date, conversions, cost, clicks,
               impressions, ctr, remaining_budget, daily_budget, status
        FROM google_ads_snapshots
        ORDER BY campaign_id, snapshot_date DESC
      )
      SELECT c.id, c.google_ads_campaign_id, c.name, c.campaign_url,
             c.daily_budget, c.start_date, c.end_date, c.ads_status, c.last_synced_at,
             co.name as country_name, co.code as country_code,
             ls.conversions, ls.cost, ls.clicks, ls.impressions, ls.ctr,
             ls.remaining_budget, ls.snapshot_date
      FROM campaigns c
      JOIN countries co ON co.id = c.country_id
      LEFT JOIN latest_snapshots ls ON ls.campaign_id = c.id
      WHERE c.is_active = TRUE
    `;
    const params: any[] = [];
    if (countryId) {
      params.push(countryId);
      sql += ` AND c.country_id = $${params.length}`;
    }
    sql += ' ORDER BY co.name, c.name';
    const result = await query(sql, params);
    return result.rows;
  }

  /**
   * Obtiene campañas agrupadas por cuenta de Google Ads, con resumen de recargas.
   *
   * Ejecuta 2 queries en paralelo:
   *   1. Campañas + último snapshot (similar a getCampaignDetails)
   *   2. Resumen de recargas por cuenta:
   *      - latest_recharges: última recarga por cuenta
   *      - recharges_summary: COUNT + SUM total por cuenta
   *      - same_day_flags: cuentas con >= 2 recargas en el mismo día
   *
   * Agrupa los resultados en un Map por customer_account_id y calcula totales:
   *   total_daily_budget, total_cost_today, total_remaining, total_clicks,
   *   total_impressions, total_conversions, campaigns_count, enabled/paused_count
   *
   * @param countryId  - (Opcional) Filtra campañas por country_id
   * @param accountIds - (Opcional) Filtra por array de customer_account_id
   * @returns Array de objetos-cuenta con sus campañas anidadas y resumen de recargas
   */
  async getCampaignsGroupedByAccount(countryId?: number, accountIds?: string[]): Promise<any[]> {
    let sql = `
      WITH latest_snapshots AS (
        SELECT DISTINCT ON (campaign_id)
               campaign_id, snapshot_date, conversions, cost, clicks,
               impressions, ctr, remaining_budget, daily_budget, status
        FROM google_ads_snapshots
        ORDER BY campaign_id, snapshot_date DESC
      )
      SELECT c.id, c.google_ads_campaign_id, c.name, c.campaign_url,
             c.daily_budget, c.ads_status, c.customer_account_id, c.customer_account_name,
             co.name as country_name, co.code as country_code,
             ls.conversions, ls.cost, ls.clicks, ls.impressions, ls.ctr,
             ls.remaining_budget, ls.snapshot_date
      FROM campaigns c
      JOIN countries co ON co.id = c.country_id
      LEFT JOIN latest_snapshots ls ON ls.campaign_id = c.id
      WHERE c.is_active = TRUE
    `;
    const params: any[] = [];
    if (countryId) {
      params.push(countryId);
      sql += ` AND c.country_id = $${params.length}`;
    }
    if (accountIds && accountIds.length > 0) {
      params.push(accountIds);
      sql += ` AND c.customer_account_id = ANY($${params.length})`;
    }
    sql += ' ORDER BY c.customer_account_name, c.name';

    // Build recharges query with optional account filter
    let rechargesSql = `
        WITH latest_recharges AS (
          SELECT DISTINCT ON (customer_account_id)
                 customer_account_id, recharge_amount, recharge_date
          FROM google_ads_recharges
          ORDER BY customer_account_id, recharge_date DESC
        ),
        recharges_summary AS (
          SELECT customer_account_id,
                 COUNT(*) as recharges_count,
                 COALESCE(SUM(recharge_amount), 0) as total_recharged
          FROM google_ads_recharges
          GROUP BY customer_account_id
        ),
        same_day_flags AS (
          SELECT DISTINCT customer_account_id
          FROM google_ads_recharges
          GROUP BY customer_account_id, DATE(recharge_date)
          HAVING COUNT(*) >= 2
        )
        SELECT rs.customer_account_id,
               rs.recharges_count,
               rs.total_recharged,
               lr.recharge_date as last_recharge_date,
               lr.recharge_amount as last_recharge_amount,
               (sdf.customer_account_id IS NOT NULL) as has_same_day_recharges
        FROM recharges_summary rs
        LEFT JOIN latest_recharges lr ON lr.customer_account_id = rs.customer_account_id
        LEFT JOIN same_day_flags sdf ON sdf.customer_account_id = rs.customer_account_id
      `;
    const rechargesParams: any[] = [];
    if (accountIds && accountIds.length > 0) {
      rechargesParams.push(accountIds);
      rechargesSql += ` WHERE rs.customer_account_id = ANY($${rechargesParams.length})`;
    }

    // Run campaigns query and recharges summary in parallel
    const [campaignsResult, rechargesResult] = await Promise.all([
      query(sql, params),
      query(rechargesSql, rechargesParams),
    ]);

    // Build recharges lookup: customer_account_id -> recharges summary
    const rechargesMap = new Map<string, any>();
    for (const row of rechargesResult.rows) {
      rechargesMap.set(row.customer_account_id, {
        recharges_count: parseInt(row.recharges_count),
        total_recharged: parseFloat(row.total_recharged),
        last_recharge_date: row.last_recharge_date,
        last_recharge_amount: row.last_recharge_amount ? parseFloat(row.last_recharge_amount) : null,
        has_same_day_recharges: row.has_same_day_recharges === true || row.has_same_day_recharges === 't',
      });
    }

    // Group campaigns by customer_account_id
    const accountMap = new Map<string, any>();
    for (const row of campaignsResult.rows) {
      const accountId = row.customer_account_id || 'unknown';
      if (!accountMap.has(accountId)) {
        const rechargeData = rechargesMap.get(row.customer_account_id) || {
          recharges_count: 0, total_recharged: 0, last_recharge_date: null, last_recharge_amount: null,
        };
        accountMap.set(accountId, {
          customer_account_id: row.customer_account_id || null,
          customer_account_name: row.customer_account_name || 'Sin cuenta asignada',
          total_daily_budget: 0,
          total_cost_today: 0,
          total_remaining: 0,
          total_clicks: 0,
          total_impressions: 0,
          total_conversions: 0,
          campaigns_count: 0,
          enabled_count: 0,
          paused_count: 0,
          ...rechargeData,
          campaigns: [],
        });
      }
      const acct = accountMap.get(accountId)!;
      acct.campaigns.push(row);
      acct.campaigns_count++;
      if (row.ads_status === 'ENABLED') acct.enabled_count++;
      if (row.ads_status === 'PAUSED') acct.paused_count++;
      acct.total_daily_budget += Number(row.daily_budget) || 0;
      acct.total_cost_today += Number(row.cost) || 0;
      acct.total_remaining += Number(row.remaining_budget) || 0;
      acct.total_clicks += Number(row.clicks) || 0;
      acct.total_impressions += Number(row.impressions) || 0;
      acct.total_conversions += Number(row.conversions) || 0;
    }

    return Array.from(accountMap.values());
  }

  /**
   * Obtiene el historial de snapshots de una campaña específica.
   *
   * Consulta google_ads_snapshots para los últimos N días, ordenado ASC.
   * Útil para gráficas de tendencia de costo, clicks, impresiones, etc.
   *
   * @param campaignId - ID local de la campaña (campaigns.id)
   * @param days       - Cantidad de días hacia atrás (default: 30)
   * @returns Array de snapshots ordenados por fecha ascendente
   */
  async getCampaignHistory(campaignId: number, days = 30): Promise<any[]> {
    const result = await query(
      `SELECT snapshot_date, conversions, status, remaining_budget, daily_budget, cost, clicks, impressions, ctr
       FROM google_ads_snapshots
       WHERE campaign_id = $1 AND snapshot_date >= CURRENT_DATE - $2::INTEGER
       ORDER BY snapshot_date ASC`,
      [campaignId, days]
    );
    return result.rows;
  }

  /**
   * Lista todas las cuentas de facturación sincronizadas.
   * Consulta google_ads_billing_accounts ordenado por nombre de cuenta.
   *
   * @returns Array de billing accounts con sus datos de perfil de pago
   */
  async getBillingAccounts(): Promise<any[]> {
    const result = await query(
      `SELECT id, billing_id, name, currency_code, status,
              payments_profile_name, customer_account_id, customer_account_name,
              last_synced_at
       FROM google_ads_billing_accounts ORDER BY customer_account_name, name`
    );
    return result.rows;
  }

  /**
   * Obtiene cargos de cuenta con paginación.
   * JOIN con google_ads_billing_accounts para obtener nombre de billing account.
   *
   * @param limit  - Registros por página (default: 50)
   * @param offset - Offset para paginación (default: 0)
   * @returns { rows, total } — registros paginados y total general
   */
  async getAccountCharges(limit = 50, offset = 0): Promise<{ rows: any[], total: number }> {
    const countResult = await query('SELECT COUNT(*) FROM google_ads_account_charges');
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
      `SELECT ac.id, ac.customer_account_id, ac.customer_account_name,
              ac.payments_account_id, ac.payments_profile_name,
              ac.currency_code, ac.budget_name, ac.budget_status,
              ac.budget_start_date, ac.budget_end_date,
              ac.purchase_order_number,
              ac.total_adjustments_micros,
              ac.amount_served_micros,
              ac.fetched_at,
              ba.name as billing_account_name,
              ba.billing_id as billing_account_billing_id
       FROM google_ads_account_charges ac
       LEFT JOIN google_ads_billing_accounts ba ON ba.id = ac.billing_account_id
       ORDER BY ac.customer_account_name
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return { rows: result.rows, total };
  }

  /**
   * Obtiene recargas con paginación y filtros dinámicos.
   *
   * Construye un WHERE dinámico según los filtros proporcionados:
   *   - dateFrom/dateTo: rango de fecha de recarga
   *   - account: ILIKE sobre customer_account_name
   *   - paymentProfile: ILIKE sobre payments_profile_name
   *   - accountIds: filtro por array de customer_account_id
   *
   * Incluye un CTE `account_financials` que calcula el presupuesto diario
   * total y remaining por cuenta, y una window function para detectar
   * recargas del mismo día (same_day_count >= 2).
   *
   * @param limit   - Registros por página (default: 50)
   * @param offset  - Offset para paginación (default: 0)
   * @param filters - Objeto con filtros opcionales (dateFrom, dateTo, account, paymentProfile, accountIds)
   * @returns { rows, total } — recargas paginadas con total_daily_budget y total_remaining
   */
  async getRecharges(
    limit = 50, offset = 0,
    filters: { dateFrom?: string; dateTo?: string; account?: string; paymentProfile?: string; accountIds?: string[] } = {}
  ): Promise<{ rows: any[], total: number }> {
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (filters.dateFrom) {
      conditions.push(`recharge_date >= $${idx}`);
      params.push(filters.dateFrom);
      idx++;
    }
    if (filters.dateTo) {
      conditions.push(`recharge_date <= $${idx}::date + INTERVAL '1 day'`);
      params.push(filters.dateTo);
      idx++;
    }
    if (filters.account) {
      conditions.push(`customer_account_name ILIKE $${idx}`);
      params.push(`%${filters.account}%`);
      idx++;
    }
    if (filters.paymentProfile) {
      conditions.push(`payments_profile_name ILIKE $${idx}`);
      params.push(`%${filters.paymentProfile}%`);
      idx++;
    }
    if (filters.accountIds && filters.accountIds.length > 0) {
      conditions.push(`customer_account_id = ANY($${idx})`);
      params.push(filters.accountIds);
      idx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const whereAliased = conditions.length > 0
      ? `WHERE ${conditions.map(c => 'r.' + c).join(' AND ')}`
      : '';

    const countResult = await query(`SELECT COUNT(*) FROM google_ads_recharges ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
      `WITH account_financials AS (
        SELECT c.customer_account_id,
               COALESCE(SUM(c.daily_budget), 0) as total_daily_budget,
               COALESCE(SUM(ls.remaining_budget), 0) as total_remaining
        FROM campaigns c
        LEFT JOIN (
          SELECT DISTINCT ON (campaign_id) campaign_id, remaining_budget
          FROM google_ads_snapshots
          ORDER BY campaign_id, snapshot_date DESC
        ) ls ON ls.campaign_id = c.id
        WHERE c.is_active = TRUE AND c.customer_account_id IS NOT NULL
        GROUP BY c.customer_account_id
      )
      SELECT r.id, r.customer_account_id, r.customer_account_name,
              r.payments_account_id, r.payments_profile_name,
              r.currency_code, r.recharge_amount, r.new_spending_limit,
              r.proposal_id, r.proposal_type, r.recharge_date, r.fetched_at,
              COUNT(*) OVER (PARTITION BY r.customer_account_id, DATE(r.recharge_date)) as same_day_count,
              COALESCE(af.total_daily_budget, 0) as total_daily_budget,
              COALESCE(af.total_remaining, 0) as total_remaining
       FROM google_ads_recharges r
       LEFT JOIN account_financials af ON af.customer_account_id = r.customer_account_id
       ${whereAliased}
       ORDER BY r.recharge_date DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );
    return { rows: result.rows, total };
  }

  /**
   * Exporta recargas a formato CSV con filtros opcionales.
   *
   * Genera un string CSV con header en español:
   *   "ID Cuenta,Nombre Cuenta,Cuenta de Pago,Perfil de Pago,Moneda,
   *    Monto Recarga,Nuevo Limite,Tipo,Fecha"
   *
   * El campo Tipo se traduce: 2→Inicial, 3→Recarga, 4→Cierre.
   *
   * @param filters - Mismos filtros que getRecharges (dateFrom, dateTo, account, paymentProfile)
   * @returns String CSV listo para descarga
   */
  async exportRechargesCsv(
    filters: { dateFrom?: string; dateTo?: string; account?: string; paymentProfile?: string } = {}
  ): Promise<string> {
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (filters.dateFrom) {
      conditions.push(`recharge_date >= $${idx}`);
      params.push(filters.dateFrom);
      idx++;
    }
    if (filters.dateTo) {
      conditions.push(`recharge_date <= $${idx}::date + INTERVAL '1 day'`);
      params.push(filters.dateTo);
      idx++;
    }
    if (filters.account) {
      conditions.push(`customer_account_name ILIKE $${idx}`);
      params.push(`%${filters.account}%`);
      idx++;
    }
    if (filters.paymentProfile) {
      conditions.push(`payments_profile_name ILIKE $${idx}`);
      params.push(`%${filters.paymentProfile}%`);
      idx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT customer_account_id, customer_account_name,
              payments_account_id, payments_profile_name,
              currency_code, recharge_amount, new_spending_limit,
              proposal_type, recharge_date
       FROM google_ads_recharges ${where}
       ORDER BY recharge_date DESC`,
      params
    );

    const header = 'ID Cuenta,Nombre Cuenta,Cuenta de Pago,Perfil de Pago,Moneda,Monto Recarga,Nuevo Limite,Tipo,Fecha';
    const rows = result.rows.map(r => {
      const date = r.recharge_date
        ? new Date(r.recharge_date).toISOString().replace('T', ' ').substring(0, 19)
        : '';
      const typeLabel = r.proposal_type === 2 ? 'Inicial' : r.proposal_type === 3 ? 'Recarga' : r.proposal_type === 4 ? 'Cierre' : r.proposal_type;
      return [
        r.customer_account_id,
        `"${(r.customer_account_name || '').replace(/"/g, '""')}"`,
        r.payments_account_id || '',
        `"${(r.payments_profile_name || '').replace(/"/g, '""')}"`,
        r.currency_code || '',
        r.recharge_amount,
        r.new_spending_limit,
        typeLabel,
        date,
      ].join(',');
    });

    return [header, ...rows].join('\n');
  }

  /**
   * Dashboard de recargas: ejecuta 10 queries en paralelo para KPIs y tendencias.
   *
   * QUERIES PARALELAS (todas sobre google_ads_recharges):
   *   1. Totales generales (count + sum)
   *   2. Desglose por país (detectado con CASE WHEN sobre nombre de cuenta)
   *   3. Tendencia diaria últimos 30 días
   *   4. Total de hoy
   *   5. Total de ayer
   *   6. Total de esta semana (lunes a hoy)
   *   7. Total de la semana pasada
   *   8. Total de este mes
   *   9. Total del mes pasado
   *  10. Valores únicos de payments_profile_name (para dropdowns de filtro)
   *
   * Calcula variaciones porcentuales: hoy vs ayer, semana vs semana anterior,
   * mes vs mes anterior. Si el período anterior es 0, retorna +100%.
   *
   * RESPUESTA:
   *   {
   *     kpis: { totalAmount, totalCount, avgAmount, todayTotal, weekChange, monthChange... },
   *     byCountry: [{ country, count, total }],
   *     dailyTrend: [{ date, count, total }],
   *     filters: { paymentProfiles: string[] }
   *   }
   *
   * @param filters - Filtros opcionales: country, dateFrom, dateTo, account, paymentProfile
   * @returns Objeto con KPIs, desglose por país, tendencia diaria y opciones de filtro
   */
  async getRechargesDashboard(filters: {
    country?: string;
    dateFrom?: string;
    dateTo?: string;
    account?: string;
    paymentProfile?: string;
  } = {}): Promise<any> {
    // Build WHERE clause from filters
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (filters.country) {
      conditions.push(`UPPER(customer_account_name) LIKE $${paramIdx}`);
      params.push(`%${filters.country.toUpperCase()}%`);
      paramIdx++;
    }
    if (filters.dateFrom) {
      conditions.push(`recharge_date >= $${paramIdx}`);
      params.push(filters.dateFrom);
      paramIdx++;
    }
    if (filters.dateTo) {
      conditions.push(`recharge_date <= $${paramIdx}::date + INTERVAL '1 day'`);
      params.push(filters.dateTo);
      paramIdx++;
    }
    if (filters.account) {
      conditions.push(`customer_account_name ILIKE $${paramIdx}`);
      params.push(`%${filters.account}%`);
      paramIdx++;
    }
    if (filters.paymentProfile) {
      conditions.push(`payments_profile_name ILIKE $${paramIdx}`);
      params.push(`%${filters.paymentProfile}%`);
      paramIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Country mapping SQL expression
    const countryCase = `
      CASE
        WHEN UPPER(customer_account_name) LIKE '%COLOMBIA%' THEN 'Colombia'
        WHEN UPPER(customer_account_name) LIKE '%CHILE%' THEN 'Chile'
        WHEN UPPER(customer_account_name) LIKE '%PERU%' OR UPPER(customer_account_name) LIKE '%PERÚ%' THEN 'Perú'
        WHEN UPPER(customer_account_name) LIKE '%MEXICO%' OR UPPER(customer_account_name) LIKE '%MÉXICO%' THEN 'México'
        WHEN UPPER(customer_account_name) LIKE '%PANAMA%' OR UPPER(customer_account_name) LIKE '%PANAMÁ%' THEN 'Panamá'
        WHEN UPPER(customer_account_name) LIKE '%ECUADOR%' THEN 'Ecuador'
        WHEN UPPER(customer_account_name) LIKE '%BOLIVIA%' THEN 'Bolivia'
        ELSE 'Otros'
      END`;

    // Execute all queries in parallel
    const [
      totalsResult,
      byCountryResult,
      dailyTrendResult,
      todayResult,
      yesterdayResult,
      thisWeekResult,
      lastWeekResult,
      thisMonthResult,
      lastMonthResult,
      filtersDataResult,
    ] = await Promise.all([
      // Overall totals
      query(`SELECT COUNT(*) as total_count, COALESCE(SUM(recharge_amount), 0) as total_amount
             FROM google_ads_recharges ${whereClause}`, params),

      // By country
      query(`SELECT ${countryCase} as country,
                    COUNT(*) as count,
                    COALESCE(SUM(recharge_amount), 0) as total
             FROM google_ads_recharges ${whereClause}
             GROUP BY country ORDER BY total DESC`, params),

      // Daily trend (last 30 days)
      query(`SELECT DATE(recharge_date) as date,
                    COUNT(*) as count,
                    COALESCE(SUM(recharge_amount), 0) as total
             FROM google_ads_recharges
             ${whereClause ? whereClause + ' AND' : 'WHERE'} recharge_date >= CURRENT_DATE - INTERVAL '30 days'
             GROUP BY DATE(recharge_date) ORDER BY date`, params),

      // Today
      query(`SELECT COUNT(*) as count, COALESCE(SUM(recharge_amount), 0) as total
             FROM google_ads_recharges
             ${whereClause ? whereClause + ' AND' : 'WHERE'} DATE(recharge_date) = CURRENT_DATE`, params),

      // Yesterday
      query(`SELECT COUNT(*) as count, COALESCE(SUM(recharge_amount), 0) as total
             FROM google_ads_recharges
             ${whereClause ? whereClause + ' AND' : 'WHERE'} DATE(recharge_date) = CURRENT_DATE - 1`, params),

      // This week (Mon-Sun)
      query(`SELECT COUNT(*) as count, COALESCE(SUM(recharge_amount), 0) as total
             FROM google_ads_recharges
             ${whereClause ? whereClause + ' AND' : 'WHERE'} recharge_date >= DATE_TRUNC('week', CURRENT_DATE)`, params),

      // Last week
      query(`SELECT COUNT(*) as count, COALESCE(SUM(recharge_amount), 0) as total
             FROM google_ads_recharges
             ${whereClause ? whereClause + ' AND' : 'WHERE'} recharge_date >= DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '7 days'
             AND recharge_date < DATE_TRUNC('week', CURRENT_DATE)`, params),

      // This month
      query(`SELECT COUNT(*) as count, COALESCE(SUM(recharge_amount), 0) as total
             FROM google_ads_recharges
             ${whereClause ? whereClause + ' AND' : 'WHERE'} recharge_date >= DATE_TRUNC('month', CURRENT_DATE)`, params),

      // Last month
      query(`SELECT COUNT(*) as count, COALESCE(SUM(recharge_amount), 0) as total
             FROM google_ads_recharges
             ${whereClause ? whereClause + ' AND' : 'WHERE'} recharge_date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
             AND recharge_date < DATE_TRUNC('month', CURRENT_DATE)`, params),

      // Unique filter values for dropdowns
      query(`SELECT DISTINCT payments_profile_name FROM google_ads_recharges
             WHERE payments_profile_name IS NOT NULL ORDER BY payments_profile_name`),
    ]);

    const totalCount = parseInt(totalsResult.rows[0].total_count);
    const totalAmount = parseFloat(totalsResult.rows[0].total_amount);
    const avgAmount = totalCount > 0 ? totalAmount / totalCount : 0;

    // Comparison calculations
    const todayTotal = parseFloat(todayResult.rows[0].total);
    const yesterdayTotal = parseFloat(yesterdayResult.rows[0].total);
    const thisWeekTotal = parseFloat(thisWeekResult.rows[0].total);
    const lastWeekTotal = parseFloat(lastWeekResult.rows[0].total);
    const thisMonthTotal = parseFloat(thisMonthResult.rows[0].total);
    const lastMonthTotal = parseFloat(lastMonthResult.rows[0].total);

    const calcChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    return {
      kpis: {
        totalAmount,
        totalCount,
        avgAmount,
        todayTotal,
        todayCount: parseInt(todayResult.rows[0].count),
        todayChange: calcChange(todayTotal, yesterdayTotal),
        thisWeekTotal,
        thisWeekCount: parseInt(thisWeekResult.rows[0].count),
        weekChange: calcChange(thisWeekTotal, lastWeekTotal),
        thisMonthTotal,
        thisMonthCount: parseInt(thisMonthResult.rows[0].count),
        monthChange: calcChange(thisMonthTotal, lastMonthTotal),
      },
      byCountry: byCountryResult.rows.map(r => ({
        country: r.country,
        count: parseInt(r.count),
        total: parseFloat(r.total),
      })),
      dailyTrend: dailyTrendResult.rows.map(r => ({
        date: r.date,
        count: parseInt(r.count),
        total: parseFloat(r.total),
      })),
      filters: {
        paymentProfiles: filtersDataResult.rows.map(r => r.payments_profile_name),
      },
    };
  }

  /**
   * Obtiene historial de facturación con paginación.
   * JOIN con google_ads_billing_accounts para nombre de cuenta.
   * Ordenado por issue_date DESC.
   *
   * @param limit  - Registros por página (default: 50)
   * @param offset - Offset para paginación (default: 0)
   * @returns { rows, total } — invoices paginados y total general
   */
  async getBillingHistory(limit = 50, offset = 0): Promise<{ rows: any[], total: number }> {
    const countResult = await query('SELECT COUNT(*) FROM google_ads_billing_history');
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
      `SELECT bh.*, ba.name as account_name, ba.billing_id as account_billing_id
       FROM google_ads_billing_history bh
       LEFT JOIN google_ads_billing_accounts ba ON ba.id = bh.billing_account_id
       ORDER BY bh.issue_date DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return { rows: result.rows, total };
  }

  // ════════════════════════════════════════════════════════════════════
  // Analytics Avanzados: Keywords, Dispositivos, Geo, Horario, etc.
  // ════════════════════════════════════════════════════════════════════

  /**
   * Sincroniza keywords desde keyword_view de Google Ads.
   *
   * QUERY GAQL:
   *   SELECT campaign.id, ad_group.name, ad_group_criterion.keyword.text,
   *          ad_group_criterion.keyword.match_type,
   *          ad_group_criterion.quality_info.quality_score,
   *          segments.date, metrics.clicks, impressions, cost_micros,
   *          conversions, ctr
   *   FROM keyword_view
   *   WHERE segments.date DURING LAST_14_DAYS (o LAST_30_DAYS en backfill)
   *
   * TABLA AFECTADA:
   *   google_ads_keyword_snapshots — UPSERT por (campaign_id, keyword_text, match_type, snapshot_date)
   *
   * Campos: ad_group_name, keyword_text, match_type (EXACT/PHRASE/BROAD),
   *         quality_score, clicks, impressions, cost, conversions, ctr
   *
   * @param backfill - Si true, usa LAST_30_DAYS en vez de LAST_14_DAYS
   */
  async syncKeywords(backfill: boolean | string = false): Promise<void> {
    const api = await this.getApi();
    if (!api) return;

    logger.info('Syncing Google Ads keywords...' + (typeof backfill === 'string' ? ' (historical)' : backfill ? ' (backfill LAST_30_DAYS)' : ''));
    const clientAccounts = await this.getClientAccounts();
    if (!clientAccounts.length) return;

    const managerId = env.googleAds.managerAccountId;
    const today = new Date().toISOString().split('T')[0];
    const dateFilter = this.buildDateFilter(backfill);

    // Build campaign map: google_ads_campaign_id -> local id
    const existingCampaigns = await query(
      `SELECT id, google_ads_campaign_id FROM campaigns WHERE google_ads_campaign_id IS NOT NULL`
    );
    const campaignMap = new Map(existingCampaigns.rows.map((c: any) => [String(c.google_ads_campaign_id), c.id]));

    let synced = 0;
    let errors = 0;

    await this.runWithConcurrency(clientAccounts, async (account) => {
      const customer = this.getCustomer(api, account.id, managerId);
      try {
        const results = await customer.query(`
          SELECT
            campaign.id,
            ad_group.name,
            ad_group_criterion.keyword.text,
            ad_group_criterion.keyword.match_type,
            ad_group_criterion.quality_info.quality_score,
            segments.date,
            metrics.clicks,
            metrics.impressions,
            metrics.cost_micros,
            metrics.conversions,
            metrics.ctr
          FROM keyword_view
          WHERE ${dateFilter}
        `);

        for (const row of results) {
          const adsCampaignId = String(row.campaign?.id);
          const localCampaignId = campaignMap.get(adsCampaignId);
          if (!localCampaignId) continue;

          const keywordText = row.ad_group_criterion?.keyword?.text;
          if (!keywordText) continue;

          const matchType = row.ad_group_criterion?.keyword?.match_type || null;
          const qualityScore = row.ad_group_criterion?.quality_info?.quality_score || null;
          const adGroupName = row.ad_group?.name || null;
          const snapshotDate = row.segments?.date || today;

          await query(
            `INSERT INTO google_ads_keyword_snapshots
              (campaign_id, ad_group_name, keyword_text, match_type, quality_score, clicks, impressions, cost, conversions, ctr, snapshot_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (campaign_id, keyword_text, match_type, snapshot_date)
             DO UPDATE SET
              ad_group_name = EXCLUDED.ad_group_name,
              quality_score = EXCLUDED.quality_score,
              clicks = EXCLUDED.clicks,
              impressions = EXCLUDED.impressions,
              cost = EXCLUDED.cost,
              conversions = EXCLUDED.conversions,
              ctr = EXCLUDED.ctr`,
            [
              localCampaignId,
              adGroupName,
              keywordText,
              matchType,
              qualityScore,
              row.metrics?.clicks || 0,
              row.metrics?.impressions || 0,
              (row.metrics?.cost_micros || 0) / 1_000_000,
              row.metrics?.conversions || 0,
              row.metrics?.ctr || 0,
              snapshotDate,
            ]
          );
          synced++;
        }
      } catch (err: any) {
        const msg = err.errors?.[0]?.message || err.message || '';
        if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Too many requests')) {
          const retryMatch = msg.match(/Retry in (\d+) seconds/);
          this.markRateLimited(retryMatch ? parseInt(retryMatch[1]) : 3600);
          logger.error('Rate limit hit during keyword sync');
        } else {
          errors++;
        }
      }
    }, CONCURRENCY_LIMIT);

    logger.info(`Keywords sync: ${synced} keywords synced, ${errors} errors`);
  }

  /**
   * Sincroniza rendimiento por dispositivo desde campaign view.
   *
   * QUERY GAQL:
   *   SELECT campaign.id, segments.device, segments.date,
   *          metrics.clicks, impressions, cost_micros, conversions
   *   FROM campaign
   *   WHERE segments.date DURING LAST_14_DAYS (o LAST_30_DAYS)
   *
   * El campo segments.device retorna: MOBILE, DESKTOP, TABLET, OTHER.
   *
   * TABLA AFECTADA:
   *   google_ads_device_snapshots — UPSERT por (campaign_id, device, snapshot_date)
   *
   * @param backfill - Si true, usa LAST_30_DAYS en vez de LAST_14_DAYS
   */
  async syncDevicePerformance(backfill: boolean | string = false): Promise<void> {
    const api = await this.getApi();
    if (!api) return;

    logger.info('Syncing Google Ads device performance...' + (typeof backfill === 'string' ? ' (historical)' : backfill ? ' (backfill)' : ''));
    const clientAccounts = await this.getClientAccounts();
    if (!clientAccounts.length) return;

    const managerId = env.googleAds.managerAccountId;
    const today = new Date().toISOString().split('T')[0];
    const dateFilter = this.buildDateFilter(backfill);

    const existingCampaigns = await query(
      `SELECT id, google_ads_campaign_id FROM campaigns WHERE google_ads_campaign_id IS NOT NULL`
    );
    const campaignMap = new Map(existingCampaigns.rows.map((c: any) => [String(c.google_ads_campaign_id), c.id]));

    let synced = 0;

    await this.runWithConcurrency(clientAccounts, async (account) => {
      const customer = this.getCustomer(api, account.id, managerId);
      try {
        const results = await customer.query(`
          SELECT
            campaign.id,
            segments.device,
            segments.date,
            metrics.clicks,
            metrics.impressions,
            metrics.cost_micros,
            metrics.conversions
          FROM campaign
          WHERE ${dateFilter}
        `);

        for (const row of results) {
          const adsCampaignId = String(row.campaign?.id);
          const localCampaignId = campaignMap.get(adsCampaignId);
          if (!localCampaignId) continue;

          const device = row.segments?.device || 'UNKNOWN';
          const snapshotDate = row.segments?.date || today;

          await query(
            `INSERT INTO google_ads_device_snapshots
              (campaign_id, device, clicks, impressions, cost, conversions, snapshot_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (campaign_id, device, snapshot_date)
             DO UPDATE SET
              clicks = EXCLUDED.clicks,
              impressions = EXCLUDED.impressions,
              cost = EXCLUDED.cost,
              conversions = EXCLUDED.conversions`,
            [
              localCampaignId,
              device,
              row.metrics?.clicks || 0,
              row.metrics?.impressions || 0,
              (row.metrics?.cost_micros || 0) / 1_000_000,
              row.metrics?.conversions || 0,
              snapshotDate,
            ]
          );
          synced++;
        }
      } catch (err: any) {
        const msg = err.errors?.[0]?.message || err.message || '';
        if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Too many requests')) {
          const retryMatch = msg.match(/Retry in (\d+) seconds/);
          this.markRateLimited(retryMatch ? parseInt(retryMatch[1]) : 3600);
          logger.error('Rate limit hit during device sync');
        } else {
          logger.warn(`Device sync error for account ${account.id}: ${msg}`);
        }
      }
    }, CONCURRENCY_LIMIT);

    logger.info(`Device sync: ${synced} records synced`);
  }

  /**
   * Sincroniza rendimiento geográfico desde geographic_view.
   *
   * QUERY GAQL:
   *   SELECT campaign.id, geographic_view.country_criterion_id,
   *          geographic_view.location_type, segments.date,
   *          metrics.clicks, impressions, cost_micros, conversions
   *   FROM geographic_view
   *   WHERE segments.date DURING LAST_14_DAYS (o LAST_30_DAYS)
   *
   * Los criterion IDs se almacenan temporalmente como "Geo:XXXX".
   * Después del sync, se resuelven a nombres legibles usando
   * resolveGeoCriterionNames() (consulta geo_target_constant).
   *
   * TABLA AFECTADA:
   *   google_ads_geo_snapshots — UPSERT por (campaign_id, geo_target_name, snapshot_date)
   *
   * @param backfill - Si true, usa LAST_30_DAYS en vez de LAST_14_DAYS
   */
  async syncGeoPerformance(backfill: boolean | string = false): Promise<void> {
    const api = await this.getApi();
    if (!api) return;

    logger.info('Syncing Google Ads geographic performance...' + (typeof backfill === 'string' ? ' (historical)' : backfill ? ' (backfill)' : ''));
    const clientAccounts = await this.getClientAccounts();
    if (!clientAccounts.length) return;

    const managerId = env.googleAds.managerAccountId;
    const today = new Date().toISOString().split('T')[0];
    const dateFilter = this.buildDateFilter(backfill);

    const existingCampaigns = await query(
      `SELECT id, google_ads_campaign_id FROM campaigns WHERE google_ads_campaign_id IS NOT NULL`
    );
    const campaignMap = new Map(existingCampaigns.rows.map((c: any) => [String(c.google_ads_campaign_id), c.id]));

    let synced = 0;
    let errors = 0;

    await this.runWithConcurrency(clientAccounts, async (account) => {
      const customer = this.getCustomer(api, account.id, managerId);
      try {
        const results = await customer.query(`
          SELECT
            campaign.id,
            geographic_view.country_criterion_id,
            geographic_view.location_type,
            segments.date,
            metrics.clicks,
            metrics.impressions,
            metrics.cost_micros,
            metrics.conversions
          FROM geographic_view
          WHERE ${dateFilter}
        `);

        for (const row of results) {
          const adsCampaignId = String(row.campaign?.id);
          const localCampaignId = campaignMap.get(adsCampaignId);
          if (!localCampaignId) continue;

          const countryCriterionId = row.geographic_view?.country_criterion_id;
          const geoName = countryCriterionId ? `Geo:${countryCriterionId}` : 'Unknown';
          const geoType = row.geographic_view?.location_type || 'UNKNOWN';
          const snapshotDate = row.segments?.date || today;

          await query(
            `INSERT INTO google_ads_geo_snapshots
              (campaign_id, geo_target_name, geo_target_type, clicks, impressions, cost, conversions, snapshot_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (campaign_id, geo_target_name, snapshot_date)
             DO UPDATE SET
              geo_target_type = EXCLUDED.geo_target_type,
              clicks = EXCLUDED.clicks,
              impressions = EXCLUDED.impressions,
              cost = EXCLUDED.cost,
              conversions = EXCLUDED.conversions`,
            [
              localCampaignId,
              geoName,
              geoType,
              row.metrics?.clicks || 0,
              row.metrics?.impressions || 0,
              (row.metrics?.cost_micros || 0) / 1_000_000,
              row.metrics?.conversions || 0,
              snapshotDate,
            ]
          );
          synced++;
        }
      } catch (err: any) {
        const msg = err.errors?.[0]?.message || err.message || '';
        if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Too many requests')) {
          const retryMatch = msg.match(/Retry in (\d+) seconds/);
          this.markRateLimited(retryMatch ? parseInt(retryMatch[1]) : 3600);
          logger.error('Rate limit hit during geo sync');
        } else {
          errors++;
          logger.warn(`Geo sync error for account ${account.id} (${account.name}): ${msg}`);
        }
      }
    }, CONCURRENCY_LIMIT);

    // Resolve geo criterion IDs to human-readable names
    if (synced > 0) {
      try {
        await this.resolveGeoCriterionNames(api, managerId);
      } catch (e: any) {
        logger.warn('Failed to resolve geo criterion names: ' + e.message);
      }
    }

    logger.info(`Geographic sync: ${synced} records synced, ${errors} errors`);
  }

  /**
   * Resuelve criterion IDs geográficos ("Geo:XXXX") a nombres legibles.
   *
   * Busca en google_ads_geo_snapshots las entradas con geo_target_name LIKE 'Geo:%',
   * luego consulta geo_target_constant de la API para obtener el canonical_name.
   * Actualiza la BD con los nombres resueltos.
   *
   * QUERY GAQL (por cada criterion):
   *   SELECT geo_target_constant.name, geo_target_constant.canonical_name
   *   FROM geo_target_constant
   *   WHERE resource_name = 'geoTargetConstants/{criterionId}'
   *
   * @param api       - Instancia de GoogleAdsApi
   * @param managerId - ID del MCC para autenticación
   */
  /** Mapeo estático de Geo Criterion IDs → nombres (fallback si la API falla) */
  private static readonly GEO_FALLBACK: Record<string, string> = {
    '2032': 'Argentina', '2068': 'Bolivia', '2076': 'Brasil', '2152': 'Chile',
    '2170': 'Colombia', '2188': 'Costa Rica', '2192': 'Cuba', '2218': 'Ecuador',
    '2222': 'El Salvador', '2320': 'Guatemala', '2340': 'Honduras', '2484': 'México',
    '2558': 'Nicaragua', '2591': 'Panamá', '2600': 'Paraguay', '2604': 'Perú',
    '2214': 'República Dominicana', '2858': 'Uruguay', '2862': 'Venezuela',
    '2724': 'España', '2840': 'Estados Unidos',
    '2156': 'China', '2356': 'India', '2826': 'Reino Unido', '2276': 'Alemania',
    '2250': 'Francia', '2380': 'Italia', '2392': 'Japón', '2124': 'Canadá',
    '2036': 'Australia', '2410': 'Corea del Sur', '2158': 'Taiwán',
    '2056': 'Bélgica', '2528': 'Países Bajos', '2756': 'Suiza',
    '2643': 'Rusia', '2792': 'Turquía', '2818': 'Egipto', '2710': 'Sudáfrica',
    '2682': 'Arabia Saudita', '2376': 'Israel', '2764': 'Tailandia',
    '2704': 'Vietnam', '2360': 'Indonesia', '2458': 'Malasia',
    '2608': 'Filipinas', '2702': 'Singapur', '2196': 'Chipre', '2300': 'Grecia',
    '2616': 'Polonia', '2620': 'Portugal', '2203': 'Chequia',
    '2348': 'Hungría', '2040': 'Austria', '2752': 'Suecia',
    '2578': 'Noruega', '2208': 'Dinamarca', '2246': 'Finlandia',
    '2372': 'Irlanda', '2554': 'Nueva Zelanda',
  };

  private async resolveGeoCriterionNames(api: any, managerId: string): Promise<void> {
    // Find unresolved names (still "Geo:XXXX")
    const unresolvedResult = await query(
      `SELECT DISTINCT geo_target_name FROM google_ads_geo_snapshots WHERE geo_target_name LIKE 'Geo:%'`
    );
    if (unresolvedResult.rows.length === 0) return;

    const criterionIds = unresolvedResult.rows.map((r: any) => r.geo_target_name.replace('Geo:', ''));
    logger.info(`Resolving ${criterionIds.length} geo criterion names...`);

    const customer = this.getCustomer(api, managerId);
    const nameMap = new Map<string, string>();

    // First: apply static fallback for known IDs
    for (const criterionId of criterionIds) {
      const fallback = GoogleAdsSyncService.GEO_FALLBACK[criterionId];
      if (fallback) nameMap.set(criterionId, fallback);
    }

    // Then: try API resolution for any remaining (overrides fallback with canonical names)
    const unresolved = criterionIds.filter(id => !nameMap.has(id));
    for (const criterionId of [...unresolved, ...criterionIds.filter(id => nameMap.has(id))]) {
      try {
        const results = await customer.query(
          `SELECT geo_target_constant.name, geo_target_constant.canonical_name FROM geo_target_constant WHERE geo_target_constant.resource_name = 'geoTargetConstants/${criterionId}'`
        );
        if (results.length > 0) {
          const name = results[0].geo_target_constant?.canonical_name || results[0].geo_target_constant?.name || null;
          if (name) nameMap.set(criterionId, name);
        }
      } catch {
        // API failed - fallback already in map if known ID
      }
    }

    // Update DB with resolved names — use INSERT+DELETE to avoid duplicate key violations
    // when the resolved name already exists for the same (campaign_id, snapshot_date)
    for (const [criterionId, name] of nameMap) {
      const geoKey = `Geo:${criterionId}`;
      await query(
        `INSERT INTO google_ads_geo_snapshots
           (campaign_id, geo_target_name, geo_target_type, clicks, impressions, cost, conversions, snapshot_date)
         SELECT campaign_id, $1, geo_target_type, clicks, impressions, cost, conversions, snapshot_date
         FROM google_ads_geo_snapshots
         WHERE geo_target_name = $2
         ON CONFLICT (campaign_id, geo_target_name, snapshot_date) DO UPDATE SET
           geo_target_type = EXCLUDED.geo_target_type,
           clicks = google_ads_geo_snapshots.clicks + EXCLUDED.clicks,
           impressions = google_ads_geo_snapshots.impressions + EXCLUDED.impressions,
           cost = google_ads_geo_snapshots.cost + EXCLUDED.cost,
           conversions = google_ads_geo_snapshots.conversions + EXCLUDED.conversions`,
        [name, geoKey]
      );
      await query(
        `DELETE FROM google_ads_geo_snapshots WHERE geo_target_name = $1`,
        [geoKey]
      );
    }
    logger.info(`Resolved ${nameMap.size} of ${criterionIds.length} geo criterion names`);
  }

  /**
   * Sincroniza rendimiento por localidad (regiones, ciudades) usando user_location_view.
   * Guarda en google_ads_location_snapshots.
   */
  async syncUserLocationPerformance(backfill: boolean | string = false): Promise<void> {
    const api = await this.getApi();
    if (!api) return;

    logger.info('Syncing Google Ads location performance...' + (typeof backfill === 'string' ? ' (historical)' : backfill ? ' (backfill)' : ''));
    const clientAccounts = await this.getClientAccounts();
    if (!clientAccounts.length) return;

    const managerId = env.googleAds.managerAccountId;

    const dateFilter = this.buildDateFilter(backfill);

    let synced = 0;
    let errors = 0;

    await this.runWithConcurrency(clientAccounts, async (account: any) => {
      if (this.isRateLimited()) return;
      try {
        const customer = this.getCustomer(api, account.id, managerId);
        const localCampaigns = await query(
          `SELECT id, google_ads_campaign_id FROM campaigns WHERE customer_account_id = $1 AND ads_status = 'ENABLED'`,
          [account.id]
        );
        if (localCampaigns.rows.length === 0) return;

        const campaignMap = new Map<string, number>();
        for (const c of localCampaigns.rows) {
          campaignMap.set(String(c.google_ads_campaign_id), c.id);
        }

        const results = await customer.query(`
          SELECT
            campaign.id,
            user_location_view.country_criterion_id,
            user_location_view.targeting_location,
            segments.geo_target_most_specific_location,
            segments.date,
            metrics.clicks,
            metrics.impressions,
            metrics.cost_micros,
            metrics.conversions
          FROM user_location_view
          WHERE ${dateFilter}
        `);

        for (const row of results) {
          const gCampaignId = String(row.campaign?.id);
          const localCampaignId = campaignMap.get(gCampaignId);
          if (!localCampaignId) continue;

          const countryCriterionId = String(row.user_location_view?.country_criterion_id || '');
          // segments.geo_target_most_specific_location is a resource name like "geoTargetConstants/1009973"
          const geoTargetLocation = row.segments?.geo_target_most_specific_location || '';
          const locationCriterionId = typeof geoTargetLocation === 'string'
            ? geoTargetLocation.replace('geoTargetConstants/', '')
            : String(geoTargetLocation);

          if (!locationCriterionId || locationCriterionId === countryCriterionId) continue; // Skip country-level (already in geo_snapshots)

          const countryName = GoogleAdsSyncService.GEO_FALLBACK[countryCriterionId] || `Geo:${countryCriterionId}`;
          const locationName = `Loc:${locationCriterionId}`;

          const clicks = Number(row.metrics?.clicks) || 0;
          const impressions = Number(row.metrics?.impressions) || 0;
          const costMicros = Number(row.metrics?.cost_micros) || 0;
          const cost = costMicros / 1_000_000;
          const conversions = Number(row.metrics?.conversions) || 0;
          const snapshotDate = row.segments?.date || new Date().toISOString().slice(0, 10);

          await query(`
            INSERT INTO google_ads_location_snapshots
              (campaign_id, country_criterion_id, country_name, location_criterion_id, location_name, clicks, impressions, cost, conversions, snapshot_date)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (campaign_id, location_criterion_id, snapshot_date) DO UPDATE SET
              clicks = EXCLUDED.clicks,
              impressions = EXCLUDED.impressions,
              cost = EXCLUDED.cost,
              conversions = EXCLUDED.conversions
          `, [localCampaignId, countryCriterionId, countryName, locationCriterionId, locationName, clicks, impressions, cost, conversions, snapshotDate]);
          synced++;
        }
      } catch (e: any) {
        const msg = e.message || '';
        if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
          this.markRateLimited();
          logger.error('Rate limit hit during location sync');
        } else {
          errors++;
          logger.warn(`Location sync error for account ${account.id}: ${msg}`);
        }
      }
    }, CONCURRENCY_LIMIT);

    // Resolve location criterion IDs to names
    if (synced > 0) {
      try {
        await this.resolveLocationCriterionNames(api, managerId);
      } catch (e: any) {
        logger.warn('Failed to resolve location criterion names: ' + e.message);
      }
    }

    logger.info(`Location sync: ${synced} records synced, ${errors} errors`);
  }

  /** Resolve location criterion IDs (Loc:XXXX) to readable names using geo_target_constant API */
  private async resolveLocationCriterionNames(api: any, managerId: string): Promise<void> {
    const unresolvedResult = await query(
      `SELECT DISTINCT location_criterion_id, location_name FROM google_ads_location_snapshots WHERE location_name LIKE 'Loc:%' LIMIT 200`
    );
    if (unresolvedResult.rows.length === 0) return;

    const criterionIds = unresolvedResult.rows.map((r: any) => r.location_criterion_id);
    logger.info(`Resolving ${criterionIds.length} location criterion names...`);

    const customer = this.getCustomer(api, managerId);
    const nameMap = new Map<string, { name: string; type: string }>();

    for (const criterionId of criterionIds) {
      try {
        const results = await customer.query(
          `SELECT geo_target_constant.name, geo_target_constant.canonical_name, geo_target_constant.target_type FROM geo_target_constant WHERE geo_target_constant.resource_name = 'geoTargetConstants/${criterionId}'`
        );
        if (results.length > 0) {
          const gc = results[0].geo_target_constant;
          const name = gc?.canonical_name || gc?.name || null;
          const targetType = gc?.target_type || 'UNKNOWN';
          if (name) nameMap.set(criterionId, { name, type: targetType });
        }
      } catch {
        // Skip unresolvable IDs
      }
    }

    for (const [criterionId, info] of nameMap) {
      await query(
        `UPDATE google_ads_location_snapshots SET location_name = $1, location_type = $2 WHERE location_criterion_id = $3 AND location_name LIKE 'Loc:%'`,
        [info.name, info.type, criterionId]
      );
    }
    logger.info(`Resolved ${nameMap.size} of ${criterionIds.length} location criterion names`);
  }

  /**
   * Sincroniza rendimiento por hora del día desde campaign view.
   *
   * QUERY GAQL:
   *   SELECT campaign.id, segments.hour, segments.day_of_week,
   *          segments.date, metrics.clicks, impressions, cost_micros, conversions
   *   FROM campaign
   *   WHERE segments.date DURING LAST_14_DAYS (o LAST_30_DAYS)
   *
   * Convierte day_of_week de enum (MONDAY=0, ..., SUNDAY=6) a entero.
   * segments.hour retorna 0-23 representando la hora del día.
   *
   * TABLA AFECTADA:
   *   google_ads_hourly_snapshots — UPSERT por (campaign_id, hour_of_day, day_of_week, snapshot_date)
   *
   * @param backfill - Si true, usa LAST_30_DAYS en vez de LAST_14_DAYS
   */
  async syncHourlyPerformance(backfill: boolean | string = false): Promise<void> {
    const api = await this.getApi();
    if (!api) return;

    logger.info('Syncing Google Ads hourly performance...' + (typeof backfill === 'string' ? ' (historical)' : backfill ? ' (backfill)' : ''));
    const clientAccounts = await this.getClientAccounts();
    if (!clientAccounts.length) return;

    const managerId = env.googleAds.managerAccountId;
    const today = new Date().toISOString().split('T')[0];
    const dateFilter = this.buildDateFilter(backfill);

    const existingCampaigns = await query(
      `SELECT id, google_ads_campaign_id FROM campaigns WHERE google_ads_campaign_id IS NOT NULL`
    );
    const campaignMap = new Map(existingCampaigns.rows.map((c: any) => [String(c.google_ads_campaign_id), c.id]));

    let synced = 0;

    await this.runWithConcurrency(clientAccounts, async (account) => {
      const customer = this.getCustomer(api, account.id, managerId);
      try {
        const results = await customer.query(`
          SELECT
            campaign.id,
            segments.hour,
            segments.day_of_week,
            segments.date,
            metrics.clicks,
            metrics.impressions,
            metrics.cost_micros,
            metrics.conversions
          FROM campaign
          WHERE ${dateFilter}
        `);

        // Map Google Ads day_of_week enum to integer (0=Mon..6=Sun)
        const dayMap: Record<string, number> = {
          MONDAY: 0, TUESDAY: 1, WEDNESDAY: 2, THURSDAY: 3,
          FRIDAY: 4, SATURDAY: 5, SUNDAY: 6,
        };

        for (const row of results) {
          const adsCampaignId = String(row.campaign?.id);
          const localCampaignId = campaignMap.get(adsCampaignId);
          if (!localCampaignId) continue;

          const hour = row.segments?.hour ?? 0;
          const dayOfWeekStr = row.segments?.day_of_week || 'MONDAY';
          const dayOfWeek = dayMap[dayOfWeekStr] ?? 0;
          const snapshotDate = row.segments?.date || today;

          await query(
            `INSERT INTO google_ads_hourly_snapshots
              (campaign_id, hour_of_day, day_of_week, clicks, impressions, cost, conversions, snapshot_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (campaign_id, hour_of_day, day_of_week, snapshot_date)
             DO UPDATE SET
              clicks = EXCLUDED.clicks,
              impressions = EXCLUDED.impressions,
              cost = EXCLUDED.cost,
              conversions = EXCLUDED.conversions`,
            [
              localCampaignId,
              hour,
              dayOfWeek,
              row.metrics?.clicks || 0,
              row.metrics?.impressions || 0,
              (row.metrics?.cost_micros || 0) / 1_000_000,
              row.metrics?.conversions || 0,
              snapshotDate,
            ]
          );
          synced++;
        }
      } catch (err: any) {
        const msg = err.errors?.[0]?.message || err.message || '';
        if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Too many requests')) {
          const retryMatch = msg.match(/Retry in (\d+) seconds/);
          this.markRateLimited(retryMatch ? parseInt(retryMatch[1]) : 3600);
          logger.error('Rate limit hit during hourly sync');
        } else {
          logger.warn(`Hourly sync error for account ${account.id}: ${msg}`);
        }
      }
    }, CONCURRENCY_LIMIT);

    logger.info(`Hourly sync: ${synced} records synced`);
  }

  /**
   * Orquestador de analytics avanzados — ejecuta todos los syncs de análisis en secuencia.
   *
   * ORDEN DE EJECUCIÓN:
   *   1. syncKeywords()           → google_ads_keyword_snapshots
   *   2. syncDevicePerformance()  → google_ads_device_snapshots
   *   3. syncGeoPerformance()     → google_ads_geo_snapshots
   *   4. syncHourlyPerformance()  → google_ads_hourly_snapshots
   *   5. syncSearchTerms()        → google_ads_search_term_snapshots
   *   6. syncAdPerformance()      → google_ads_ad_snapshots
   *   7. syncDemographics()       → google_ads_demographics_snapshots
   *   8. syncAssetPerformance()   → google_ads_asset_snapshots
   *
   * Resetea los flags de rate limit al inicio del ciclo.
   * Si un método activa el rate limit, los siguientes se saltan automáticamente.
   * Loguea cuántos de los 8 métodos se ejecutaron exitosamente.
   *
   * @param backfill - Si true, todos los métodos usan LAST_30_DAYS en vez de LAST_14_DAYS
   */
  async syncEnhancedAnalytics(backfill: boolean | string = false): Promise<void> {
    logger.info('Starting enhanced analytics sync...' + (
      typeof backfill === 'string' ? ` (HISTORICAL: ${backfill})` :
      backfill ? ' (BACKFILL MODE - LAST_30_DAYS)' : ''
    ));

    // Reset rate limit flag only at the START of a full enhanced sync
    this.rateLimitHit = false;
    this.rateLimitResetAt = 0;

    const methods: { name: string; fn: () => Promise<void> }[] = [
      { name: 'Keywords', fn: () => this.syncKeywords(backfill) },
      { name: 'Devices', fn: () => this.syncDevicePerformance(backfill) },
      { name: 'Geo', fn: () => this.syncGeoPerformance(backfill) },
      { name: 'Locations', fn: () => this.syncUserLocationPerformance(backfill) },
      { name: 'Hourly', fn: () => this.syncHourlyPerformance(backfill) },
      { name: 'SearchTerms', fn: () => this.syncSearchTerms(backfill) },
      { name: 'AdPerformance', fn: () => this.syncAdPerformance(backfill) },
      { name: 'Demographics', fn: () => this.syncDemographics(backfill) },
      { name: 'Assets', fn: () => this.syncAssetPerformance(backfill) },
    ];

    let completed = 0;
    for (const method of methods) {
      if (this.isRateLimited()) {
        logger.warn(`Skipping ${method.name} sync — rate limit active`);
        continue;
      }
      try {
        await method.fn();
        completed++;
      } catch (e: any) {
        logger.error(`${method.name} sync failed: ${e.message}`);
      }
    }

    logger.info(`Enhanced analytics sync completed (${completed}/${methods.length} methods ran)`);
  }

  /**
   * Dispatcher para ejecutar un método de sync individual por nombre.
   * Diseñado para cron distribuido: permite ejecutar cada analytics
   * en diferentes momentos para distribuir la carga de la API.
   *
   * Nombres válidos:
   *   'keywords' | 'devices' | 'geo' | 'hourly' | 'searchTerms' |
   *   'adPerformance' | 'demographics' | 'assets'
   *
   * Verifica rate limit antes de ejecutar. Si está activo, retorna false
   * sin intentar la sincronización.
   *
   * @param methodName - Nombre del método a ejecutar (ver lista arriba)
   * @param backfill   - Si true, usa LAST_30_DAYS
   * @returns true si el método se ejecutó, false si estaba rate-limited o nombre inválido
   */
  async syncSingleMethod(methodName: string, backfill: boolean | string = false): Promise<boolean> {
    if (this.isRateLimited()) {
      logger.warn(`[DISTRIBUTED SYNC] Skipping ${methodName} — rate limit active`);
      return false;
    }

    logger.info(`[DISTRIBUTED SYNC] Running ${methodName}...` + (typeof backfill === 'string' ? ' (historical)' : backfill ? ' (backfill)' : ''));

    try {
      switch (methodName) {
        case 'keywords': await this.syncKeywords(backfill); break;
        case 'devices': await this.syncDevicePerformance(backfill); break;
        case 'geo': await this.syncGeoPerformance(backfill); break;
        case 'locations': await this.syncUserLocationPerformance(backfill); break;
        case 'hourly': await this.syncHourlyPerformance(backfill); break;
        case 'searchTerms': await this.syncSearchTerms(backfill); break;
        case 'adPerformance': await this.syncAdPerformance(backfill); break;
        case 'demographics': await this.syncDemographics(backfill); break;
        case 'assets': await this.syncAssetPerformance(backfill); break;
        default: logger.warn(`Unknown sync method: ${methodName}`); return false;
      }
      logger.info(`[DISTRIBUTED SYNC] ${methodName} completed`);
      return true;
    } catch (e: any) {
      logger.error(`[DISTRIBUTED SYNC] ${methodName} failed: ${e.message}`);
      throw e;
    }
  }

  /**
   * Sincroniza términos de búsqueda desde search_term_view.
   *
   * QUERY GAQL:
   *   SELECT search_term_view.search_term, search_term_view.status,
   *          campaign.id, ad_group.name, segments.date,
   *          metrics.clicks, impressions, cost_micros, conversions, ctr
   *   FROM search_term_view
   *   WHERE segments.date DURING LAST_14_DAYS (o LAST_30_DAYS)
   *
   * TABLA AFECTADA:
   *   google_ads_search_term_snapshots — UPSERT por (campaign_id, search_term, snapshot_date)
   *
   * Los términos de búsqueda representan las consultas reales que los usuarios
   * escribieron en Google y que activaron los anuncios.
   *
   * @param backfill - Si true, usa LAST_30_DAYS en vez de LAST_14_DAYS
   */
  async syncSearchTerms(backfill: boolean | string = false): Promise<void> {
    const api = await this.getApi();
    if (!api) return;

    logger.info('Syncing Google Ads search terms...' + (typeof backfill === 'string' ? ' (historical)' : backfill ? ' (backfill)' : ''));
    const clientAccounts = await this.getClientAccounts();
    if (!clientAccounts.length) return;

    const managerId = env.googleAds.managerAccountId;
    const today = new Date().toISOString().split('T')[0];
    const dateFilter = this.buildDateFilter(backfill);

    const existingCampaigns = await query(
      `SELECT id, google_ads_campaign_id FROM campaigns WHERE google_ads_campaign_id IS NOT NULL`
    );
    const campaignMap = new Map(existingCampaigns.rows.map((c: any) => [String(c.google_ads_campaign_id), c.id]));

    let synced = 0;
    let errors = 0;

    await this.runWithConcurrency(clientAccounts, async (account) => {
      const customer = this.getCustomer(api, account.id, managerId);
      try {
        const results = await customer.query(`
          SELECT
            search_term_view.search_term,
            search_term_view.status,
            campaign.id,
            ad_group.name,
            segments.date,
            metrics.clicks,
            metrics.impressions,
            metrics.cost_micros,
            metrics.conversions,
            metrics.ctr
          FROM search_term_view
          WHERE ${dateFilter}
        `);

        for (const row of results) {
          const adsCampaignId = String(row.campaign?.id);
          const localCampaignId = campaignMap.get(adsCampaignId);
          if (!localCampaignId) continue;

          const searchTerm = row.search_term_view?.search_term;
          if (!searchTerm) continue;

          const status = row.search_term_view?.status || null;
          const adGroupName = row.ad_group?.name || null;
          const clicks = Number(row.metrics?.clicks) || 0;
          const impressions = Number(row.metrics?.impressions) || 0;
          const costMicros = Number(row.metrics?.cost_micros) || 0;
          const cost = costMicros / 1_000_000;
          const conversions = Number(row.metrics?.conversions) || 0;
          const ctr = Number(row.metrics?.ctr) || 0;

          await query(`
            INSERT INTO google_ads_search_term_snapshots
              (campaign_id, ad_group_name, search_term, status, clicks, impressions, cost, conversions, ctr, snapshot_date)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (campaign_id, search_term, snapshot_date) DO UPDATE SET
              ad_group_name = EXCLUDED.ad_group_name,
              status = EXCLUDED.status,
              clicks = EXCLUDED.clicks,
              impressions = EXCLUDED.impressions,
              cost = EXCLUDED.cost,
              conversions = EXCLUDED.conversions,
              ctr = EXCLUDED.ctr
          `, [localCampaignId, adGroupName, searchTerm, status, clicks, impressions, cost, conversions, ctr, row.segments?.date || today]);

          synced++;
        }
      } catch (e: any) {
        const msg = e.errors?.[0]?.message || e.message || '';
        if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Too many requests')) {
          const retryMatch = msg.match(/Retry in (\d+) seconds/);
          this.markRateLimited(retryMatch ? parseInt(retryMatch[1]) : 3600);
          logger.error('Rate limit hit during search terms sync');
        } else {
          errors++;
          logger.error(`Search terms sync error for account ${account.id}: ${msg}`);
        }
      }
    });

    logger.info(`Search terms sync completed: ${synced} synced, ${errors} errors`);
  }

  /**
   * Sincroniza rendimiento de anuncios individuales desde ad_group_ad.
   *
   * QUERY GAQL:
   *   SELECT campaign.id, ad_group.id, ad_group.name,
   *          ad_group_ad.ad.id, ad_group_ad.ad.type,
   *          ad_group_ad.ad.responsive_search_ad.headlines,
   *          ad_group_ad.ad.responsive_search_ad.descriptions,
   *          ad_group_ad.ad.final_urls, ad_group_ad.status,
   *          segments.date, metrics.*
   *   FROM ad_group_ad
   *   WHERE segments.date DURING LAST_14_DAYS AND status != 'REMOVED'
   *
   * Los headlines y descriptions de Responsive Search Ads se almacenan
   * como JSON stringificado. final_urls se toma el primer elemento del array.
   *
   * TABLA AFECTADA:
   *   google_ads_ad_snapshots — UPSERT por (campaign_id, ad_id, snapshot_date)
   *
   * @param backfill - Si true, usa LAST_30_DAYS en vez de LAST_14_DAYS
   */
  async syncAdPerformance(backfill: boolean | string = false): Promise<void> {
    const api = await this.getApi();
    if (!api) return;

    logger.info('Syncing Google Ads ad performance...' + (typeof backfill === 'string' ? ' (historical)' : backfill ? ' (backfill)' : ''));
    const clientAccounts = await this.getClientAccounts();
    if (!clientAccounts.length) return;

    const managerId = env.googleAds.managerAccountId;
    const today = new Date().toISOString().split('T')[0];
    const dateFilter = this.buildDateFilter(backfill);

    const existingCampaigns = await query(
      `SELECT id, google_ads_campaign_id FROM campaigns WHERE google_ads_campaign_id IS NOT NULL`
    );
    const campaignMap = new Map(existingCampaigns.rows.map((c: any) => [String(c.google_ads_campaign_id), c.id]));

    let synced = 0;
    let errors = 0;

    await this.runWithConcurrency(clientAccounts, async (account) => {
      const customer = this.getCustomer(api, account.id, managerId);
      try {
        const results = await customer.query(`
          SELECT
            campaign.id,
            ad_group.id,
            ad_group.name,
            ad_group_ad.ad.id,
            ad_group_ad.ad.type,
            ad_group_ad.ad.responsive_search_ad.headlines,
            ad_group_ad.ad.responsive_search_ad.descriptions,
            ad_group_ad.ad.final_urls,
            ad_group_ad.status,
            segments.date,
            metrics.clicks,
            metrics.impressions,
            metrics.cost_micros,
            metrics.conversions,
            metrics.ctr
          FROM ad_group_ad
          WHERE ${dateFilter}
            AND ad_group_ad.status != 'REMOVED'
        `);

        for (const row of results) {
          const adsCampaignId = String(row.campaign?.id);
          const localCampaignId = campaignMap.get(adsCampaignId);
          if (!localCampaignId) continue;

          const adGroupId = String(row.ad_group?.id || '');
          const adGroupName = row.ad_group?.name || null;
          const adId = String(row.ad_group_ad?.ad?.id || '');
          if (!adId) continue;

          const adType = row.ad_group_ad?.ad?.type || null;

          // Extract headlines and descriptions from responsive search ads
          const headlines = row.ad_group_ad?.ad?.responsive_search_ad?.headlines;
          const headlinesStr = headlines ? JSON.stringify(headlines) : null;
          const descriptions = row.ad_group_ad?.ad?.responsive_search_ad?.descriptions;
          const descriptionsStr = descriptions ? JSON.stringify(descriptions) : null;

          const finalUrls = row.ad_group_ad?.ad?.final_urls;
          const finalUrl = Array.isArray(finalUrls) && finalUrls.length > 0 ? finalUrls[0] : null;

          const status = row.ad_group_ad?.status || null;
          const clicks = Number(row.metrics?.clicks) || 0;
          const impressions = Number(row.metrics?.impressions) || 0;
          const costMicros = Number(row.metrics?.cost_micros) || 0;
          const cost = costMicros / 1_000_000;
          const conversions = Number(row.metrics?.conversions) || 0;
          const ctr = Number(row.metrics?.ctr) || 0;

          await query(`
            INSERT INTO google_ads_ad_snapshots
              (campaign_id, ad_group_id, ad_group_name, ad_id, ad_type, headlines, descriptions, final_url, status, clicks, impressions, cost, conversions, ctr, snapshot_date)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            ON CONFLICT (campaign_id, ad_id, snapshot_date) DO UPDATE SET
              ad_group_id = EXCLUDED.ad_group_id,
              ad_group_name = EXCLUDED.ad_group_name,
              ad_type = EXCLUDED.ad_type,
              headlines = EXCLUDED.headlines,
              descriptions = EXCLUDED.descriptions,
              final_url = EXCLUDED.final_url,
              status = EXCLUDED.status,
              clicks = EXCLUDED.clicks,
              impressions = EXCLUDED.impressions,
              cost = EXCLUDED.cost,
              conversions = EXCLUDED.conversions,
              ctr = EXCLUDED.ctr
          `, [localCampaignId, adGroupId, adGroupName, adId, adType, headlinesStr, descriptionsStr, finalUrl, status, clicks, impressions, cost, conversions, ctr, row.segments?.date || today]);

          synced++;
        }
      } catch (e: any) {
        const msg = e.errors?.[0]?.message || e.message || '';
        if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Too many requests')) {
          const retryMatch = msg.match(/Retry in (\d+) seconds/);
          this.markRateLimited(retryMatch ? parseInt(retryMatch[1]) : 3600);
          logger.error('Rate limit hit during ad performance sync');
        } else {
          errors++;
          logger.error(`Ad performance sync error for account ${account.id}: ${msg}`);
        }
      }
    });

    logger.info(`Ad performance sync completed: ${synced} synced, ${errors} errors`);
  }

  // ════════════════════════════════════════════════════════════════════
  // Auction Insights — Análisis de subastas (semanal)
  // ════════════════════════════════════════════════════════════════════

  /**
   * Sincroniza métricas de competencia (auction insights) de los últimos 7 días.
   *
   * Solo procesa campañas tipo SEARCH con status ENABLED.
   *
   * QUERY GAQL:
   *   SELECT campaign.id, campaign.name,
   *          metrics.search_impression_share,
   *          metrics.search_rank_lost_impression_share,
   *          metrics.search_budget_lost_impression_share
   *   FROM campaign
   *   WHERE advertising_channel_type = 'SEARCH'
   *     AND status = 'ENABLED'
   *     AND segments.date DURING LAST_7_DAYS
   *
   * TABLA AFECTADA:
   *   google_ads_auction_insights — UPSERT por (campaign_id, display_domain, snapshot_date)
   *
   * NOTA: display_domain se guarda como el nombre de la campaña (self),
   *       overlap_rate y position_above_rate se mapean desde rank_lost_is y budget_lost_is.
   */
  async syncAuctionInsights(): Promise<void> {
    const api = await this.getApi();
    if (!api) return;

    logger.info('Syncing Google Ads auction insights...');
    const clientAccounts = await this.getClientAccounts();
    if (!clientAccounts.length) return;

    const managerId = env.googleAds.managerAccountId;
    const today = new Date().toISOString().split('T')[0];

    const existingCampaigns = await query(
      `SELECT id, google_ads_campaign_id FROM campaigns WHERE google_ads_campaign_id IS NOT NULL`
    );
    const campaignMap = new Map(existingCampaigns.rows.map((c: any) => [String(c.google_ads_campaign_id), c.id]));

    let synced = 0;
    let errors = 0;

    await this.runWithConcurrency(clientAccounts, async (account) => {
      const customer = this.getCustomer(api, account.id, managerId);
      try {
        const results = await customer.query(`
          SELECT
            campaign.id,
            campaign.name,
            metrics.search_impression_share,
            metrics.search_rank_lost_impression_share,
            metrics.search_budget_lost_impression_share
          FROM campaign
          WHERE campaign.advertising_channel_type = 'SEARCH'
            AND campaign.status = 'ENABLED'
            AND segments.date DURING LAST_7_DAYS
        `);

        for (const row of results) {
          const adsCampaignId = String(row.campaign?.id);
          const localCampaignId = campaignMap.get(adsCampaignId);
          if (!localCampaignId) continue;

          const impressionShare = Number(row.metrics?.search_impression_share) || 0;
          const rankLostIS = Number(row.metrics?.search_rank_lost_impression_share) || 0;
          const budgetLostIS = Number(row.metrics?.search_budget_lost_impression_share) || 0;

          await query(`
            INSERT INTO google_ads_auction_insights
              (campaign_id, display_domain, impression_share, overlap_rate, position_above_rate, outranking_share, snapshot_date)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (campaign_id, display_domain, snapshot_date) DO UPDATE SET
              impression_share = EXCLUDED.impression_share,
              overlap_rate = EXCLUDED.overlap_rate,
              position_above_rate = EXCLUDED.position_above_rate,
              outranking_share = EXCLUDED.outranking_share
          `, [localCampaignId, row.campaign?.name || 'self', impressionShare, rankLostIS, budgetLostIS, 0, today]);

          synced++;
        }
      } catch (e: any) {
        const msg = e.errors?.[0]?.message || e.message || '';
        if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Too many requests')) {
          const retryMatch = msg.match(/Retry in (\d+) seconds/);
          this.markRateLimited(retryMatch ? parseInt(retryMatch[1]) : 3600);
          logger.error('Rate limit hit during auction insights sync');
        } else {
          errors++;
          logger.error(`Auction insights sync error for account ${account.id}: ${msg}`);
        }
      }
    }, CONCURRENCY_LIMIT);

    logger.info(`Auction insights sync completed: ${synced} synced, ${errors} errors`);
  }

  /**
   * Sincroniza datos demográficos: edad y género por campaña.
   *
   * Ejecuta 2 queries GAQL por cuenta:
   *
   *   1. EDAD (age_range_view):
   *      SELECT campaign.id, ad_group_criterion.age_range.type,
   *             segments.date, metrics.clicks, impressions, cost_micros, conversions, ctr
   *      FROM age_range_view
   *      Valores típicos: AGE_RANGE_18_24, AGE_RANGE_25_34, etc.
   *
   *   2. GÉNERO (gender_view):
   *      SELECT campaign.id, ad_group_criterion.gender.type,
   *             segments.date, metrics.*
   *      FROM gender_view
   *      Valores típicos: MALE, FEMALE, UNDETERMINED
   *
   * TABLA AFECTADA:
   *   google_ads_demographics_snapshots — UPSERT por
   *     (campaign_id, demographic_type, demographic_value, snapshot_date)
   *   donde demographic_type es 'AGE' o 'GENDER'
   *
   * @param backfill - Si true, usa LAST_30_DAYS en vez de LAST_14_DAYS
   */
  async syncDemographics(backfill: boolean | string = false): Promise<void> {
    const api = await this.getApi();
    if (!api) return;

    logger.info('Syncing Google Ads demographics...' + (typeof backfill === 'string' ? ' (historical)' : backfill ? ' (backfill)' : ''));
    const clientAccounts = await this.getClientAccounts();
    if (!clientAccounts.length) return;

    const managerId = env.googleAds.managerAccountId;
    const today = new Date().toISOString().split('T')[0];
    const dateFilter = this.buildDateFilter(backfill);

    const existingCampaigns = await query(
      `SELECT id, google_ads_campaign_id FROM campaigns WHERE google_ads_campaign_id IS NOT NULL`
    );
    const campaignMap = new Map(existingCampaigns.rows.map((c: any) => [String(c.google_ads_campaign_id), c.id]));

    let synced = 0;
    let errors = 0;

    await this.runWithConcurrency(clientAccounts, async (account) => {
      const customer = this.getCustomer(api, account.id, managerId);

      // Age Range query
      try {
        const ageResults = await customer.query(`
          SELECT
            campaign.id,
            ad_group_criterion.age_range.type,
            segments.date,
            metrics.clicks,
            metrics.impressions,
            metrics.cost_micros,
            metrics.conversions,
            metrics.ctr
          FROM age_range_view
          WHERE ${dateFilter}
        `);

        for (const row of ageResults) {
          const adsCampaignId = String(row.campaign?.id);
          const localCampaignId = campaignMap.get(adsCampaignId);
          if (!localCampaignId) continue;

          const demographicValue = row.ad_group_criterion?.age_range?.type || 'UNKNOWN';
          const clicks = Number(row.metrics?.clicks) || 0;
          const impressions = Number(row.metrics?.impressions) || 0;
          const costMicros = Number(row.metrics?.cost_micros) || 0;
          const cost = costMicros / 1_000_000;
          const conversions = Number(row.metrics?.conversions) || 0;
          const ctr = Number(row.metrics?.ctr) || 0;

          await query(`
            INSERT INTO google_ads_demographics_snapshots
              (campaign_id, demographic_type, demographic_value, clicks, impressions, cost, conversions, ctr, snapshot_date)
            VALUES ($1, 'AGE', $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (campaign_id, demographic_type, demographic_value, snapshot_date) DO UPDATE SET
              clicks = EXCLUDED.clicks,
              impressions = EXCLUDED.impressions,
              cost = EXCLUDED.cost,
              conversions = EXCLUDED.conversions,
              ctr = EXCLUDED.ctr
          `, [localCampaignId, demographicValue, clicks, impressions, cost, conversions, ctr, row.segments?.date || today]);

          synced++;
        }
      } catch (e: any) {
        const msg = e.errors?.[0]?.message || e.message || '';
        if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Too many requests')) {
          const retryMatch = msg.match(/Retry in (\d+) seconds/);
          this.markRateLimited(retryMatch ? parseInt(retryMatch[1]) : 3600);
          logger.error('Rate limit hit during demographics age sync');
        } else {
          errors++;
          logger.error(`Demographics age sync error for account ${account.id}: ${msg}`);
        }
      }

      // Gender query
      try {
        const genderResults = await customer.query(`
          SELECT
            campaign.id,
            ad_group_criterion.gender.type,
            segments.date,
            metrics.clicks,
            metrics.impressions,
            metrics.cost_micros,
            metrics.conversions,
            metrics.ctr
          FROM gender_view
          WHERE ${dateFilter}
        `);

        for (const row of genderResults) {
          const adsCampaignId = String(row.campaign?.id);
          const localCampaignId = campaignMap.get(adsCampaignId);
          if (!localCampaignId) continue;

          const demographicValue = row.ad_group_criterion?.gender?.type || 'UNKNOWN';
          const clicks = Number(row.metrics?.clicks) || 0;
          const impressions = Number(row.metrics?.impressions) || 0;
          const costMicros = Number(row.metrics?.cost_micros) || 0;
          const cost = costMicros / 1_000_000;
          const conversions = Number(row.metrics?.conversions) || 0;
          const ctr = Number(row.metrics?.ctr) || 0;

          await query(`
            INSERT INTO google_ads_demographics_snapshots
              (campaign_id, demographic_type, demographic_value, clicks, impressions, cost, conversions, ctr, snapshot_date)
            VALUES ($1, 'GENDER', $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (campaign_id, demographic_type, demographic_value, snapshot_date) DO UPDATE SET
              clicks = EXCLUDED.clicks,
              impressions = EXCLUDED.impressions,
              cost = EXCLUDED.cost,
              conversions = EXCLUDED.conversions,
              ctr = EXCLUDED.ctr
          `, [localCampaignId, demographicValue, clicks, impressions, cost, conversions, ctr, row.segments?.date || today]);

          synced++;
        }
      } catch (e: any) {
        const msg = e.errors?.[0]?.message || e.message || '';
        if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Too many requests')) {
          const retryMatch = msg.match(/Retry in (\d+) seconds/);
          this.markRateLimited(retryMatch ? parseInt(retryMatch[1]) : 3600);
          logger.error('Rate limit hit during demographics gender sync');
        } else {
          errors++;
          logger.error(`Demographics gender sync error for account ${account.id}: ${msg}`);
        }
      }
    }, CONCURRENCY_LIMIT);

    logger.info(`Demographics sync completed: ${synced} synced, ${errors} errors`);
  }

  // ════════════════════════════════════════════════════════════════════
  // Asset Performance — Headlines, descriptions, sitelinks
  // ════════════════════════════════════════════════════════════════════

  /**
   * Sincroniza rendimiento de assets (headlines, descriptions, sitelinks).
   *
   * QUERY GAQL PRINCIPAL (ad_group_ad_asset_view):
   *   SELECT campaign.id, ad_group.id, ad_group_ad_asset_view.field_type,
   *          asset.id, asset.type, asset.text_asset.text,
   *          asset.sitelink_asset.link_text, asset.sitelink_asset.final_urls,
   *          segments.date, metrics.clicks, impressions, cost_micros, conversions
   *   FROM ad_group_ad_asset_view
   *   WHERE segments.date DURING LAST_14_DAYS AND status != 'REMOVED'
   *
   * Tipos de asset detectados por field_type:
   *   HEADLINE | DESCRIPTION | SITELINK | CALLOUT | CALL | STRUCTURED_SNIPPET | OTHER
   *
   * FALLBACK:
   *   Si ad_group_ad_asset_view no está disponible para una cuenta
   *   (UNIMPLEMENTED / not supported), usa extractAssetsFromAdSnapshots()
   *   como fallback por cuenta.
   *   Si al final synced === 0, ejecuta populateAssetsFromAdSnapshots()
   *   como fallback global, extrayendo headlines/descriptions del JSON
   *   almacenado en google_ads_ad_snapshots.
   *
   * TABLA AFECTADA:
   *   google_ads_asset_snapshots — UPSERT por (campaign_id, asset_id, snapshot_date)
   *
   * @param backfill - Si true, usa LAST_30_DAYS en vez de LAST_14_DAYS
   */
  async syncAssetPerformance(backfill: boolean | string = false): Promise<void> {
    const api = await this.getApi();
    if (!api) return;

    logger.info('Syncing Google Ads asset performance...' + (typeof backfill === 'string' ? ' (historical)' : backfill ? ' (backfill)' : ''));
    const clientAccounts = await this.getClientAccounts();
    if (!clientAccounts.length) return;

    const managerId = env.googleAds.managerAccountId;
    const today = new Date().toISOString().split('T')[0];
    const dateFilter = this.buildDateFilter(backfill);

    const existingCampaigns = await query(
      `SELECT id, google_ads_campaign_id FROM campaigns WHERE google_ads_campaign_id IS NOT NULL`
    );
    const campaignMap = new Map(existingCampaigns.rows.map((c: any) => [String(c.google_ads_campaign_id), c.id]));

    let synced = 0;
    let errors = 0;

    await this.runWithConcurrency(clientAccounts, async (account) => {
      const customer = this.getCustomer(api, account.id, managerId);

      // Try ad_group_ad_asset_view for per-asset metrics
      try {
        const results = await customer.query(`
          SELECT
            campaign.id,
            ad_group.id,
            ad_group_ad_asset_view.field_type,
            asset.id,
            asset.type,
            asset.text_asset.text,
            asset.sitelink_asset.link_text,
            asset.sitelink_asset.final_urls,
            segments.date,
            metrics.clicks,
            metrics.impressions,
            metrics.cost_micros,
            metrics.conversions
          FROM ad_group_ad_asset_view
          WHERE ${dateFilter}
            AND ad_group_ad.status != 'REMOVED'
        `);

        for (const row of results) {
          const adsCampaignId = String(row.campaign?.id);
          const localCampaignId = campaignMap.get(adsCampaignId);
          if (!localCampaignId) continue;

          const adGroupId = String(row.ad_group?.id || '');
          const assetId = String(row.asset?.id || '');
          if (!assetId) continue;

          // Determine asset type from field_type
          const fieldType = row.ad_group_ad_asset_view?.field_type || '';
          let assetType = 'OTHER';
          if (fieldType === 'HEADLINE' || fieldType === 2) assetType = 'HEADLINE';
          else if (fieldType === 'DESCRIPTION' || fieldType === 3) assetType = 'DESCRIPTION';
          else if (fieldType === 'SITELINK' || fieldType === 17) assetType = 'SITELINK';
          else if (fieldType === 'CALLOUT' || fieldType === 18) assetType = 'CALLOUT';
          else if (fieldType === 'CALL' || fieldType === 19) assetType = 'CALL';
          else if (fieldType === 'STRUCTURED_SNIPPET' || fieldType === 22) assetType = 'STRUCTURED_SNIPPET';

          // Extract text and url depending on asset type
          let assetText = row.asset?.text_asset?.text || null;
          let assetUrl: string | null = null;

          if (assetType === 'SITELINK') {
            assetText = row.asset?.sitelink_asset?.link_text || assetText;
            const sitelinkUrls = row.asset?.sitelink_asset?.final_urls;
            if (Array.isArray(sitelinkUrls) && sitelinkUrls.length > 0) {
              assetUrl = sitelinkUrls[0];
            }
          }

          const clicks = Number(row.metrics?.clicks) || 0;
          const impressions = Number(row.metrics?.impressions) || 0;
          const costMicros = Number(row.metrics?.cost_micros) || 0;
          const cost = costMicros / 1_000_000;
          const conversions = Number(row.metrics?.conversions) || 0;
          const snapshotDate = row.segments?.date || today;

          await query(`
            INSERT INTO google_ads_asset_snapshots
              (campaign_id, ad_group_id, asset_id, asset_type, asset_text, asset_url, clicks, impressions, cost, conversions, snapshot_date)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (campaign_id, asset_id, snapshot_date) DO UPDATE SET
              ad_group_id = EXCLUDED.ad_group_id,
              asset_type = EXCLUDED.asset_type,
              asset_text = EXCLUDED.asset_text,
              asset_url = EXCLUDED.asset_url,
              clicks = EXCLUDED.clicks,
              impressions = EXCLUDED.impressions,
              cost = EXCLUDED.cost,
              conversions = EXCLUDED.conversions
          `, [localCampaignId, adGroupId, assetId, assetType, assetText, assetUrl, clicks, impressions, cost, conversions, snapshotDate]);

          synced++;
        }
      } catch (e: any) {
        // If ad_group_ad_asset_view fails, try extracting from existing ad snapshots
        if (e.message?.includes('not found') || e.message?.includes('UNIMPLEMENTED') || e.message?.includes('not supported')) {
          logger.warn(`Asset view not available for account ${account.id}, extracting from ad snapshots...`);
          try {
            await this.extractAssetsFromAdSnapshots(account.id, localCampaignId => campaignMap, today, backfill);
          } catch (fallbackErr: any) {
            errors++;
            logger.error(`Asset fallback extraction error for account ${account.id}: ${fallbackErr.message}`);
          }
        } else if (e.message?.includes('RESOURCE_EXHAUSTED') || e.message?.includes('Too many requests')) {
          const retryMatch = e.message.match(/Retry in (\d+) seconds/);
          this.markRateLimited(retryMatch ? parseInt(retryMatch[1]) : 3600);
          logger.error('Rate limit hit during asset sync');
        } else {
          errors++;
          logger.error(`Asset sync error for account ${account.id}: ${e.message}`);
        }
      }
    }, CONCURRENCY_LIMIT);

    // If no asset_view data was obtained, populate from existing ad_snapshots as fallback
    if (synced === 0) {
      logger.info('No assets from API views, extracting from existing ad snapshot data...');
      await this.populateAssetsFromAdSnapshots(backfill);
    }

    logger.info(`Asset performance sync completed: ${synced} synced, ${errors} errors`);
  }

  /**
   * Fallback global: extrae assets desde el JSON de google_ads_ad_snapshots.
   *
   * Cuando la API de asset_view no está disponible, este método parsea los
   * campos `headlines` y `descriptions` (JSON arrays) de los snapshots de
   * anuncios existentes y crea registros sintéticos en google_ads_asset_snapshots.
   *
   * LÓGICA:
   *   - Lee google_ads_ad_snapshots donde headlines/descriptions IS NOT NULL
   *   - Para cada headline[i], crea asset_id = "{ad_id}_H{i}" con type HEADLINE
   *   - Para cada description[i], crea asset_id = "{ad_id}_D{i}" con type DESCRIPTION
   *   - Las métricas se distribuyen proporcionalmente: clicks / N headlines, etc.
   *
   * TABLA AFECTADA:
   *   google_ads_asset_snapshots — UPSERT por (campaign_id, asset_id, snapshot_date)
   *
   * @param backfill - Si true, lee últimos 30 días; si false, solo hoy
   */
  private async populateAssetsFromAdSnapshots(backfill: boolean | string = false): Promise<void> {
    const dateFilter = typeof backfill === 'string'
      ? `snapshot_date >= CURRENT_DATE - INTERVAL '3 years'`
      : backfill
        ? `snapshot_date >= CURRENT_DATE - INTERVAL '30 days'`
        : `snapshot_date = CURRENT_DATE`;

    const adSnapshots = await query(`
      SELECT campaign_id, ad_group_id, ad_id, headlines, descriptions, final_url, snapshot_date,
             clicks, impressions, cost, conversions
      FROM google_ads_ad_snapshots
      WHERE ${dateFilter} AND (headlines IS NOT NULL OR descriptions IS NOT NULL)
    `);

    let synced = 0;

    for (const row of adSnapshots.rows) {
      // Process headlines
      if (row.headlines) {
        try {
          const headlines = typeof row.headlines === 'string' ? JSON.parse(row.headlines) : row.headlines;
          if (Array.isArray(headlines)) {
            for (let i = 0; i < headlines.length; i++) {
              const text = headlines[i]?.text || headlines[i];
              if (!text) continue;
              const assetId = `${row.ad_id}_H${i}`;
              // Distribute metrics proportionally across headlines
              const portion = 1 / headlines.length;
              await query(`
                INSERT INTO google_ads_asset_snapshots
                  (campaign_id, ad_group_id, asset_id, asset_type, asset_text, clicks, impressions, cost, conversions, snapshot_date)
                VALUES ($1, $2, $3, 'HEADLINE', $4, $5, $6, $7, $8, $9)
                ON CONFLICT (campaign_id, asset_id, snapshot_date) DO UPDATE SET
                  asset_text = EXCLUDED.asset_text,
                  clicks = EXCLUDED.clicks,
                  impressions = EXCLUDED.impressions,
                  cost = EXCLUDED.cost,
                  conversions = EXCLUDED.conversions
              `, [
                row.campaign_id, row.ad_group_id, assetId, text,
                Math.round((Number(row.clicks) || 0) * portion),
                Math.round((Number(row.impressions) || 0) * portion),
                Number(((Number(row.cost) || 0) * portion).toFixed(2)),
                Number(((Number(row.conversions) || 0) * portion).toFixed(2)),
                row.snapshot_date,
              ]);
              synced++;
            }
          }
        } catch { /* skip malformed JSON */ }
      }

      // Process descriptions
      if (row.descriptions) {
        try {
          const descriptions = typeof row.descriptions === 'string' ? JSON.parse(row.descriptions) : row.descriptions;
          if (Array.isArray(descriptions)) {
            for (let i = 0; i < descriptions.length; i++) {
              const text = descriptions[i]?.text || descriptions[i];
              if (!text) continue;
              const assetId = `${row.ad_id}_D${i}`;
              const portion = 1 / descriptions.length;
              await query(`
                INSERT INTO google_ads_asset_snapshots
                  (campaign_id, ad_group_id, asset_id, asset_type, asset_text, clicks, impressions, cost, conversions, snapshot_date)
                VALUES ($1, $2, $3, 'DESCRIPTION', $4, $5, $6, $7, $8, $9)
                ON CONFLICT (campaign_id, asset_id, snapshot_date) DO UPDATE SET
                  asset_text = EXCLUDED.asset_text,
                  clicks = EXCLUDED.clicks,
                  impressions = EXCLUDED.impressions,
                  cost = EXCLUDED.cost,
                  conversions = EXCLUDED.conversions
              `, [
                row.campaign_id, row.ad_group_id, assetId, text,
                Math.round((Number(row.clicks) || 0) * portion),
                Math.round((Number(row.impressions) || 0) * portion),
                Number(((Number(row.cost) || 0) * portion).toFixed(2)),
                Number(((Number(row.conversions) || 0) * portion).toFixed(2)),
                row.snapshot_date,
              ]);
              synced++;
            }
          }
        } catch { /* skip malformed JSON */ }
      }
    }

    logger.info(`Asset extraction from ad snapshots: ${synced} assets created`);
  }

  /**
   * Fallback por cuenta individual: delega a populateAssetsFromAdSnapshots().
   * Disponible para reintentos por cuenta, pero actualmente usa el fallback global.
   *
   * @param _accountId    - ID de cuenta Google Ads (no usado directamente)
   * @param _campaignMapFn - Función que retorna el mapa de campañas (no usado)
   * @param _today        - Fecha actual ISO (no usado)
   * @param _backfill     - Modo backfill (pasado al fallback global)
   */
  private async extractAssetsFromAdSnapshots(
    _accountId: string,
    _campaignMapFn: (id: number) => Map<string, number>,
    _today: string,
    _backfill: boolean | string
  ): Promise<void> {
    // Use global fallback instead
    await this.populateAssetsFromAdSnapshots(_backfill);
  }
}

/** Instancia singleton del servicio de sincronización con Google Ads */
export const googleAdsSyncService = new GoogleAdsSyncService();
