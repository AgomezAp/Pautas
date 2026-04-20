/**
 * ══════════════════════════════════════════════════════════════════════
 *  Google Ads Analysis Service — Servicio Principal de Análisis
 * ══════════════════════════════════════════════════════════════════════
 *
 *  PROPÓSITO:
 *    Capa de orquestación principal. Provee 50+ endpoints analíticos
 *    para el dashboard de Google Ads. Accede a la BD directamente.
 *
 *  TABLAS QUE CONSULTA:
 *    google_ads_snapshots, campaigns, countries,
 *    google_ads_keyword_snapshots, google_ads_device_snapshots,
 *    google_ads_geo_snapshots, google_ads_hourly_snapshots,
 *    google_ads_search_term_snapshots, google_ads_ad_snapshots,
 *    google_ads_auction_insights, google_ads_demographics_snapshots,
 *    account_conversion_config
 *
 *  DEPENDENCIAS:
 *    ─ predictive-budget.service.ts → getPredictiveAnalysis()
 *    ─ ml-analytics.service.ts → fitHoltWinters(), simpleMovingAverageForecast()
 *    ─ enum-mapping.service.ts → traduce códigos numéricos de Google Ads
 *
 *  ORGANIZACIÓN POR SECCIONES:
 *    ── Gasto y Rendimiento: getSpendingTrend, getPerformanceMetrics, getAccountRankings
 *    ── Distribución de Presupuesto: getBudgetDistribution
 *    ── Impression Share: getImpressionShareTrend
 *    ── Campañas: getCampaignTypeBreakdown, getBiddingStrategyAnalysis
 *    ── Keywords: getTopKeywords, getKeywordQualityDistribution
 *    ── Dispositivos: getDeviceBreakdown
 *    ── Geográfico: getGeoPerformance, getGeoMapData, getCountryEfficiencyReport
 *    ── Inteligencia de Presupuesto: getBudgetPacing, getWasteDetection,
 *       getOptimalSchedule, getBudgetForecast, getBudgetRedistribution,
 *       getSmartBudgetRecommendations
 *    ── Heatmap Horario: getHourlyHeatmap
 *    ── Comparación Temporal: getTemporalComparison
 *    ── CPA y Calidad: getCPAAnalysis, getQualityScoreTrend
 *    ── Tendencia CPC: getCPCTrend (con regresión lineal)
 *    ── Estacionalidad: getSeasonalityPatterns
 *    ── Términos de Búsqueda: getSearchTerms, getNegativeKeywordCandidates,
 *       getLongTailAnalysis, getKeywordCannibalization
 *    ── Anuncios: getAdPerformanceComparison, getAdFatigueDetection, getAdTypePerformance
 *    ── Competencia: getAuctionInsightsSummary, getCompetitivePosition, getMarketOpportunities
 *    ── Demografía: getAgeBreakdown, getGenderBreakdown
 *    ── Phase 9 Enhanced: getDeviceBidRecommendations, getDeviceExclusions,
 *       getGeoTierClassification, getRegionalPatterns, getKeywordActionPlan,
 *       getMatchTypeRecommendations, getCrossAccountKeywords
 *    ── Forecasting: getFullForecast, getScalingHealth, getCompetitiveMarketTrend
 *    ── Executive Dashboard: getAccountHealthScores, getExecutiveSummary, getTopRecommendations
 *    ── Auditoría Financiera: getZombieKeywords, getVampireCampaigns, getConsolidatedActionPlan
 *    ── Benchmark: getAccountBenchmark, getPortfolioRecommendation, getAccountPatterns
 *    ── Wave 4: getLandingPageAnalysis, getConversionFunnel, getMonthOverMonthComparison
 *    ── ML Predictivo: getPredictiveAnalysis (delega a predictiveBudgetService)
 * ══════════════════════════════════════════════════════════════════════
 */

import { query } from '../config/database';
import { EnumMappingService } from './enum-mapping.service';
import { predictiveBudgetService } from './predictive-budget.service';
import { fitHoltWinters, simpleMovingAverageForecast } from './ml-analytics.service';

export class GoogleAdsAnalysisService {

  /**
   * Mapeo estático de Google Ads Geo Criterion IDs a nombres legibles.
   * Usado como fallback cuando resolveGeoCriterionNames() falla en el sync.
   * IDs tomados de: https://developers.google.com/google-ads/api/reference/data/geotargets
   */
  private static readonly GEO_NAMES: Record<string, string> = {
    '2032': 'Argentina', '2068': 'Bolivia', '2076': 'Brasil', '2152': 'Chile',
    '2170': 'Colombia', '2188': 'Costa Rica', '2192': 'Cuba', '2218': 'Ecuador',
    '2222': 'El Salvador', '2320': 'Guatemala', '2340': 'Honduras', '2484': 'México',
    '2558': 'Nicaragua', '2591': 'Panamá', '2600': 'Paraguay', '2604': 'Perú',
    '2214': 'República Dominicana', '2858': 'Uruguay', '2862': 'Venezuela',
    '2724': 'España', '2840': 'Estados Unidos',
    '2156': 'China', '2356': 'India', '2826': 'Reino Unido', '2276': 'Alemania',
    '2250': 'Francia', '2380': 'Italia', '2392': 'Japón', '2124': 'Canadá',
    '2036': 'Australia', '2158': 'Taiwán', '2410': 'Corea del Sur',
    '2056': 'Bélgica', '2528': 'Países Bajos', '2756': 'Suiza',
    '2643': 'Rusia', '2792': 'Turquía',
    '2818': 'Egipto', '2710': 'Sudáfrica', '2682': 'Arabia Saudita',
    '2376': 'Israel', '2764': 'Tailandia', '2704': 'Vietnam',
    '2360': 'Indonesia', '2458': 'Malasia', '2608': 'Filipinas',
    '2702': 'Singapur', '2196': 'Chipre', '2300': 'Grecia',
    '2616': 'Polonia', '2620': 'Portugal', '2203': 'Chequia',
    '2348': 'Hungría', '2040': 'Austria', '2752': 'Suecia',
    '2578': 'Noruega', '2208': 'Dinamarca', '2246': 'Finlandia',
    '2372': 'Irlanda', '2554': 'Nueva Zelanda',
  };

  /**
   * Genera expresión SQL CASE para traducir "Geo:XXXX" a nombres legibles.
   * Se usa en todas las queries geográficas como fallback.
   * @param column - Nombre de la columna (ej. 'gs.geo_target_name')
   * @param alias  - Alias de salida (ej. 'geo_target_name')
   */
  private geoNameSql(column: string, alias: string): string {
    const cases = Object.entries(GoogleAdsAnalysisService.GEO_NAMES)
      .map(([id, name]) => `WHEN ${column} = 'Geo:${id}' THEN '${name}'`)
      .join(' ');
    return `CASE ${cases} ELSE ${column} END AS ${alias}`;
  }

  /**
   * Helper privado. Agrega filtro SQL `customer_account_id = ANY($N)` cuando
   * el pautador solo puede ver ciertas cuentas.
   *
   * @param conditions - Array de condiciones SQL WHERE al que se agrega el filtro.
   * @param values     - Array de valores parametrizados para la consulta.
   * @param paramIdx   - Índice actual del siguiente parámetro ($N).
   * @param accountIds - Lista opcional de IDs de cuentas permitidas para el pautador.
   * @returns El nuevo índice de parámetro (incrementado si se agregó filtro).
   */
  private addAccountIdsFilter(
    conditions: string[], values: any[], paramIdx: number, accountIds?: string[]
  ): number {
    if (accountIds && accountIds.length > 0) {
      conditions.push(`c.customer_account_id = ANY($${paramIdx}::text[])`);
      values.push(accountIds);
      return paramIdx + 1;
    }
    return paramIdx;
  }

  /**
   * Rango de fechas disponibles en google_ads_snapshots.
   *
   * Consulta: SELECT MIN(snapshot_date), MAX(snapshot_date), COUNT(DISTINCT snapshot_date)
   * Tabla: google_ads_snapshots
   *
   * @returns Objeto con min_date, max_date y distinct_dates (cantidad de días con datos).
   */
  async getDataRange() {
    const sql = `
      SELECT MIN(snapshot_date) AS min_date, MAX(snapshot_date) AS max_date,
             COUNT(DISTINCT snapshot_date) AS distinct_dates
      FROM google_ads_snapshots
    `;
    const result = await query(sql, []);
    return result.rows[0] || { min_date: null, max_date: null, distinct_dates: 0 };
  }

  /**
   * Tendencia de gasto agrupada por periodo (diario/semanal/mensual).
   *
   * Usa DATE_TRUNC según la granularidad recibida. Para cada periodo calcula:
   * - total_cost: suma de gs.cost
   * - total_budget: suma de gs.daily_budget
   * - campaigns_count: campañas distintas activas
   *
   * Tablas: google_ads_snapshots JOIN campaigns
   *
   * @param params.granularity - 'daily' | 'weekly' | 'monthly'
   * @param params.dateFrom    - Fecha inicio del rango.
   * @param params.dateTo      - Fecha fin del rango.
   * @param params.accountId   - (Opcional) Filtrar por cuenta específica.
   * @param params.accountIds  - (Opcional) Filtrar por lista de cuentas (pautador).
   * @param params.countryId   - (Opcional) Filtrar por país.
   * @returns Array de filas con period, total_cost, total_budget, campaigns_count.
   */
  async getSpendingTrend(params: {
    granularity: string;
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const granularity = params.granularity || 'daily';
    let truncExpr: string;
    switch (granularity) {
      case 'weekly':
        truncExpr = "DATE_TRUNC('week', gs.snapshot_date)";
        break;
      case 'monthly':
        truncExpr = "DATE_TRUNC('month', gs.snapshot_date)";
        break;
      default:
        truncExpr = "DATE_TRUNC('day', gs.snapshot_date)";
    }

    const conditions: string[] = ['gs.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;

    if (params.accountId) {
      conditions.push(`c.customer_account_id = $${paramIdx}`);
      values.push(params.accountId);
      paramIdx++;
    }
    paramIdx = this.addAccountIdsFilter(conditions, values, paramIdx, params.accountIds);
    if (params.countryId) {
      conditions.push(`c.country_id = $${paramIdx}`);
      values.push(params.countryId);
      paramIdx++;
    }

    const sql = `
      SELECT
        ${truncExpr} AS period,
        SUM(gs.cost) AS total_cost,
        SUM(COALESCE(gs.daily_budget, 0)) AS total_budget,
        COUNT(DISTINCT gs.campaign_id) AS campaigns_count
      FROM google_ads_snapshots gs
      JOIN campaigns c ON c.id = gs.campaign_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY period
      ORDER BY period ASC
    `;

    const result = await query(sql, values);
    return result.rows;
  }

  /**
   * Métricas de rendimiento por cuenta.
   *
   * Calcula por cada customer_account_id:
   * - total_cost, total_clicks, total_impressions, total_conversions
   * - CPC = cost / clicks
   * - CTR = (clicks / impressions) × 100
   * - ROI = (conversions / cost) × 100
   *
   * Tablas: google_ads_snapshots JOIN campaigns LEFT JOIN countries
   *
   * @param params.dateFrom   - Fecha inicio.
   * @param params.dateTo     - Fecha fin.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Array de filas con métricas por cuenta, ordenado por total_cost DESC.
   */
  async getPerformanceMetrics(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const conditions: string[] = ['gs.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;

    if (params.accountId) {
      conditions.push(`c.customer_account_id = $${paramIdx}`);
      values.push(params.accountId);
      paramIdx++;
    }
    paramIdx = this.addAccountIdsFilter(conditions, values, paramIdx, params.accountIds);
    if (params.countryId) {
      conditions.push(`c.country_id = $${paramIdx}`);
      values.push(params.countryId);
      paramIdx++;
    }

    const sql = `
      SELECT
        c.customer_account_id,
        c.customer_account_name,
        co.name AS country_name,
        SUM(gs.cost) AS total_cost,
        SUM(gs.clicks) AS total_clicks,
        SUM(gs.impressions) AS total_impressions,
        SUM(gs.conversions) AS total_conversions,
        CASE WHEN SUM(gs.clicks) > 0
          THEN ROUND(SUM(gs.cost) / SUM(gs.clicks), 2)
          ELSE 0
        END AS cpc,
        CASE WHEN SUM(gs.impressions) > 0
          THEN ROUND((SUM(gs.clicks)::numeric / SUM(gs.impressions)) * 100, 2)
          ELSE 0
        END AS ctr,
        CASE WHEN SUM(gs.cost) > 0
          THEN ROUND((SUM(gs.conversions)::numeric / SUM(gs.cost)) * 100, 2)
          ELSE 0
        END AS roi
      FROM google_ads_snapshots gs
      JOIN campaigns c ON c.id = gs.campaign_id
      LEFT JOIN countries co ON co.id = c.country_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY c.customer_account_id, c.customer_account_name, co.name
      ORDER BY total_cost DESC
    `;

    const result = await query(sql, values);
    return result.rows;
  }

  /**
   * Rankings de cuentas por métrica elegida (spend, conversions, clicks).
   *
   * Permite obtener Top N o Bottom N cuentas según la métrica seleccionada.
   * La expresión SQL de la métrica se resuelve dinámicamente.
   *
   * Tablas: google_ads_snapshots JOIN campaigns LEFT JOIN countries
   *
   * @param params.metric - 'spend' | 'conversions' | 'clicks'
   * @param params.sort   - 'top' (DESC) | 'bottom' (ASC)
   * @param params.limit  - Cantidad de resultados (default 10).
   * @param params.dateFrom - Fecha inicio.
   * @param params.dateTo   - Fecha fin.
   * @returns Array de filas con customer_account_id, metric_value y métricas complementarias.
   */
  async getAccountRankings(params: {
    metric: string;
    sort: string;
    limit: number;
    dateFrom: string;
    dateTo: string;
  }) {
    const metricMap: Record<string, string> = {
      spend: 'SUM(gs.cost)',
      conversions: 'SUM(gs.conversions)',
      clicks: 'SUM(gs.clicks)',
    };

    const metricExpr = metricMap[params.metric] || metricMap['spend'];
    const sortDir = params.sort === 'bottom' ? 'ASC' : 'DESC';
    const limitVal = params.limit || 10;

    const sql = `
      SELECT
        c.customer_account_id,
        c.customer_account_name,
        co.name AS country_name,
        ${metricExpr} AS metric_value,
        SUM(gs.cost) AS total_cost,
        SUM(gs.clicks) AS total_clicks,
        SUM(gs.conversions) AS total_conversions,
        SUM(gs.impressions) AS total_impressions
      FROM google_ads_snapshots gs
      JOIN campaigns c ON c.id = gs.campaign_id
      LEFT JOIN countries co ON co.id = c.country_id
      WHERE gs.snapshot_date BETWEEN $1 AND $2
      GROUP BY c.customer_account_id, c.customer_account_name, co.name
      ORDER BY metric_value ${sortDir}
      LIMIT $3
    `;

    const result = await query(sql, [params.dateFrom, params.dateTo, limitVal]);
    return result.rows;
  }

  /**
   * Distribución de presupuesto por país.
   *
   * Usa DISTINCT ON para obtener el último snapshot por campaña.
   * Agrupa por país y calcula:
   * - assigned_budget: suma de daily_budget
   * - spent: suma de cost
   * - execution_pct: porcentaje de ejecución = (spent / assigned_budget) × 100
   * - accounts_count: cuentas distintas
   *
   * Tablas: google_ads_snapshots (CTE latest_snapshots), campaigns, countries
   *
   * @param params.countryId - (Opcional) Filtrar por país específico.
   * @returns Array de filas por país con presupuesto asignado, gastado y % de ejecución.
   */
  async getBudgetDistribution(params: { countryId?: number }) {
    const conditions: string[] = ["c.ads_status = 'ENABLED'"];
    const values: any[] = [];
    let paramIdx = 1;

    if (params.countryId) {
      conditions.push(`c.country_id = $${paramIdx}`);
      values.push(params.countryId);
      paramIdx++;
    }

    const whereClause = conditions.length > 0
      ? 'WHERE ' + conditions.join(' AND ')
      : '';

    const sql = `
      WITH latest_snapshots AS (
        SELECT DISTINCT ON (gs.campaign_id)
          gs.campaign_id,
          gs.cost,
          gs.daily_budget,
          gs.snapshot_date
        FROM google_ads_snapshots gs
        ORDER BY gs.campaign_id, gs.snapshot_date DESC
      )
      SELECT
        co.name AS country_name,
        SUM(COALESCE(ls.daily_budget, 0)) AS assigned_budget,
        SUM(ls.cost) AS spent,
        CASE WHEN SUM(COALESCE(ls.daily_budget, 0)) > 0
          THEN ROUND((SUM(ls.cost) / SUM(COALESCE(ls.daily_budget, 0))) * 100, 2)
          ELSE 0
        END AS execution_pct,
        COUNT(DISTINCT c.customer_account_id) AS accounts_count
      FROM latest_snapshots ls
      JOIN campaigns c ON c.id = ls.campaign_id
      LEFT JOIN countries co ON co.id = c.country_id
      ${whereClause}
      GROUP BY co.name
      ORDER BY assigned_budget DESC
    `;

    const result = await query(sql, values);
    return result.rows;
  }
  /**
   * Tendencia de cuota de impresiones (Impression Share) agrupada por periodo.
   *
   * Métricas calculadas (promedios × 100 para expresar en %):
   * - avg_impression_share: IS promedio de búsqueda
   * - avg_top_impression_rate: tasa de impresión en parte superior
   * - avg_abs_top_impression_rate: tasa de impresión en parte superior absoluta
   * - avg_budget_lost_is: IS perdida por presupuesto
   * - avg_rank_lost_is: IS perdida por ranking (Ad Rank)
   * - campaigns_count: campañas con datos de IS
   *
   * Tablas: google_ads_snapshots JOIN campaigns
   * Filtro adicional: search_impression_share IS NOT NULL
   *
   * @param params.granularity - 'daily' | 'weekly' | 'monthly'
   * @param params.dateFrom    - Fecha inicio.
   * @param params.dateTo      - Fecha fin.
   * @param params.accountId   - (Opcional) Cuenta específica.
   * @param params.accountIds  - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId   - (Opcional) Filtrar por país.
   * @returns Array de filas por periodo con métricas de Impression Share.
   */
  async getImpressionShareTrend(params: {
    granularity: string;
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const granularity = params.granularity || 'daily';
    let truncExpr: string;
    switch (granularity) {
      case 'weekly':
        truncExpr = "DATE_TRUNC('week', gs.snapshot_date)";
        break;
      case 'monthly':
        truncExpr = "DATE_TRUNC('month', gs.snapshot_date)";
        break;
      default:
        truncExpr = "DATE_TRUNC('day', gs.snapshot_date)";
    }

    const conditions: string[] = ['gs.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;

    if (params.accountId) {
      conditions.push(`c.customer_account_id = $${paramIdx}`);
      values.push(params.accountId);
      paramIdx++;
    }
    paramIdx = this.addAccountIdsFilter(conditions, values, paramIdx, params.accountIds);
    if (params.countryId) {
      conditions.push(`c.country_id = $${paramIdx}`);
      values.push(params.countryId);
      paramIdx++;
    }

    const sql = `
      SELECT
        ${truncExpr} AS period,
        ROUND(AVG(gs.search_impression_share) * 100, 2) AS avg_impression_share,
        ROUND(AVG(gs.search_top_impression_rate) * 100, 2) AS avg_top_impression_rate,
        ROUND(AVG(gs.search_abs_top_impression_rate) * 100, 2) AS avg_abs_top_impression_rate,
        ROUND(AVG(gs.search_budget_lost_is) * 100, 2) AS avg_budget_lost_is,
        ROUND(AVG(gs.search_rank_lost_is) * 100, 2) AS avg_rank_lost_is,
        COUNT(DISTINCT gs.campaign_id) AS campaigns_count
      FROM google_ads_snapshots gs
      JOIN campaigns c ON c.id = gs.campaign_id
      WHERE ${conditions.join(' AND ')}
        AND gs.search_impression_share IS NOT NULL
      GROUP BY period
      ORDER BY period ASC
    `;

    const result = await query(sql, values);
    return result.rows;
  }

  /**
   * Rendimiento por tipo de campaña (Search, Display, Video, Shopping, PMax, etc.).
   *
   * Usa CASE para mapear channel_type numérico o textual al nombre legible.
   * Métricas: campaigns_count, total_cost, total_clicks, total_impressions,
   * total_conversions, CPC, CTR.
   *
   * Tablas: google_ads_snapshots JOIN campaigns
   *
   * @param params.dateFrom   - Fecha inicio.
   * @param params.dateTo     - Fecha fin.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Array de filas por channel_type con métricas agregadas.
   */
  async getCampaignTypeBreakdown(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const conditions: string[] = ['gs.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;

    if (params.accountId) {
      conditions.push(`c.customer_account_id = $${paramIdx}`);
      values.push(params.accountId);
      paramIdx++;
    }
    paramIdx = this.addAccountIdsFilter(conditions, values, paramIdx, params.accountIds);
    if (params.countryId) {
      conditions.push(`c.country_id = $${paramIdx}`);
      values.push(params.countryId);
      paramIdx++;
    }

    const sql = `
      SELECT
        CASE
          WHEN c.channel_type IN ('SEARCH','2') THEN 'Search'
          WHEN c.channel_type IN ('DISPLAY','3') THEN 'Display'
          WHEN c.channel_type IN ('VIDEO','6') THEN 'Video'
          WHEN c.channel_type IN ('SHOPPING','7') THEN 'Shopping'
          WHEN c.channel_type IN ('PERFORMANCE_MAX','10') THEN 'Performance Max'
          WHEN c.channel_type IN ('DISCOVERY','11','DEMAND_GEN') THEN 'Demand Gen'
          WHEN c.channel_type IN ('LOCAL','9') THEN 'Local'
          WHEN c.channel_type IN ('SMART','8') THEN 'Smart'
          WHEN c.channel_type IN ('APP','14','MULTI_CHANNEL') THEN 'App'
          WHEN c.channel_type IS NULL THEN 'Desconocido'
          ELSE c.channel_type
        END AS channel_type,
        COUNT(DISTINCT c.id) AS campaigns_count,
        SUM(gs.cost) AS total_cost,
        SUM(gs.clicks) AS total_clicks,
        SUM(gs.impressions) AS total_impressions,
        SUM(gs.conversions) AS total_conversions,
        CASE WHEN SUM(gs.clicks) > 0
          THEN ROUND(SUM(gs.cost) / SUM(gs.clicks), 2)
          ELSE 0
        END AS cpc,
        CASE WHEN SUM(gs.impressions) > 0
          THEN ROUND((SUM(gs.clicks)::numeric / SUM(gs.impressions)) * 100, 2)
          ELSE 0
        END AS ctr
      FROM google_ads_snapshots gs
      JOIN campaigns c ON c.id = gs.campaign_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY channel_type
      ORDER BY total_cost DESC
    `;

    const result = await query(sql, values);
    return result.rows;
  }

  /**
   * Rendimiento por estrategia de puja (Target CPA, Target ROAS, Max Conversions, etc.).
   *
   * Usa CASE para mapear bidding_strategy_type numérico o textual al nombre legible.
   * Métricas: campaigns_count, total_cost, total_clicks, total_impressions,
   * total_conversions, CPC, CTR, ROI, avg_impression_share.
   *
   * Tablas: google_ads_snapshots JOIN campaigns
   *
   * @param params.dateFrom   - Fecha inicio.
   * @param params.dateTo     - Fecha fin.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Array de filas por bidding_strategy con métricas agregadas.
   */
  async getBiddingStrategyAnalysis(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const conditions: string[] = ['gs.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;

    if (params.accountId) {
      conditions.push(`c.customer_account_id = $${paramIdx}`);
      values.push(params.accountId);
      paramIdx++;
    }
    paramIdx = this.addAccountIdsFilter(conditions, values, paramIdx, params.accountIds);
    if (params.countryId) {
      conditions.push(`c.country_id = $${paramIdx}`);
      values.push(params.countryId);
      paramIdx++;
    }

    const sql = `
      SELECT
        CASE
          WHEN c.bidding_strategy_type IN ('TARGET_CPA','6') THEN 'Target CPA'
          WHEN c.bidding_strategy_type IN ('TARGET_ROAS','7') THEN 'Target ROAS'
          WHEN c.bidding_strategy_type IN ('MAXIMIZE_CONVERSIONS','10') THEN 'Maximize Conversions'
          WHEN c.bidding_strategy_type IN ('MAXIMIZE_CONVERSION_VALUE','11') THEN 'Maximize Conv. Value'
          WHEN c.bidding_strategy_type IN ('MAXIMIZE_CLICKS','12') THEN 'Maximize Clicks'
          WHEN c.bidding_strategy_type IN ('MANUAL_CPC','1') THEN 'Manual CPC'
          WHEN c.bidding_strategy_type IN ('MANUAL_CPM','2') THEN 'Manual CPM'
          WHEN c.bidding_strategy_type IN ('ENHANCED_CPC','3') THEN 'Enhanced CPC'
          WHEN c.bidding_strategy_type IN ('TARGET_SPEND','9') THEN 'Target Spend'
          WHEN c.bidding_strategy_type IS NULL THEN 'Desconocido'
          ELSE c.bidding_strategy_type
        END AS bidding_strategy,
        COUNT(DISTINCT c.id) AS campaigns_count,
        SUM(gs.cost) AS total_cost,
        SUM(gs.clicks) AS total_clicks,
        SUM(gs.impressions) AS total_impressions,
        SUM(gs.conversions) AS total_conversions,
        CASE WHEN SUM(gs.clicks) > 0
          THEN ROUND(SUM(gs.cost) / SUM(gs.clicks), 2)
          ELSE 0
        END AS cpc,
        CASE WHEN SUM(gs.impressions) > 0
          THEN ROUND((SUM(gs.clicks)::numeric / SUM(gs.impressions)) * 100, 2)
          ELSE 0
        END AS ctr,
        CASE WHEN SUM(gs.cost) > 0
          THEN ROUND((SUM(gs.conversions)::numeric / SUM(gs.cost)) * 100, 2)
          ELSE 0
        END AS roi,
        ROUND(AVG(gs.search_impression_share) * 100, 2) AS avg_impression_share
      FROM google_ads_snapshots gs
      JOIN campaigns c ON c.id = gs.campaign_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY bidding_strategy
      ORDER BY total_cost DESC
    `;

    const result = await query(sql, values);
    return result.rows;
  }

  // ========== Keywords Analysis ==========

  /**
   * Top keywords por métrica seleccionada.
   *
   * Tabla: google_ads_keyword_snapshots JOIN campaigns
   * Soporta agrupación por: 'flat' (sin agrupar), 'account' o 'campaign'.
   * Métricas: clicks, impressions, cost, conversions, avg_quality_score, CPC, CTR.
   * Se ordena por la métrica elegida en orden descendente, con LIMIT configurable.
   *
   * @param params.dateFrom   - Fecha inicio.
   * @param params.dateTo     - Fecha fin.
   * @param params.metric     - 'clicks' | 'conversions' | 'cost' | 'impressions' (default 'clicks').
   * @param params.matchType  - (Opcional) Filtrar por tipo de concordancia.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @param params.limit      - Cantidad máxima de resultados (default 50).
   * @param params.groupBy    - 'flat' | 'account' | 'campaign' (default 'flat').
   * @returns Array de keywords con métricas, ordenadas por sort_value DESC.
   */
  async getTopKeywords(params: {
    dateFrom: string;
    dateTo: string;
    metric?: string;
    matchType?: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
    limit?: number;
    groupBy?: string;
  }) {
    const metric = params.metric || 'clicks';
    const metricMap: Record<string, string> = {
      clicks: 'SUM(kw.clicks)',
      conversions: 'SUM(kw.conversions)',
      cost: 'SUM(kw.cost)',
      impressions: 'SUM(kw.impressions)',
    };
    const metricExpr = metricMap[metric] || metricMap['clicks'];
    const limitVal = params.limit || 50;

    const conditions: string[] = ['kw.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;

    if (params.matchType) {
      conditions.push(`kw.match_type = $${paramIdx}`);
      values.push(params.matchType);
      paramIdx++;
    }
    if (params.accountId) {
      conditions.push(`c.customer_account_id = $${paramIdx}`);
      values.push(params.accountId);
      paramIdx++;
    }
    paramIdx = this.addAccountIdsFilter(conditions, values, paramIdx, params.accountIds);
    if (params.countryId) {
      conditions.push(`c.country_id = $${paramIdx}`);
      values.push(params.countryId);
      paramIdx++;
    }

    values.push(limitVal);

    // Dynamic GROUP BY based on grouping preference
    const groupMode = params.groupBy || 'flat';
    let selectExtra = '';
    let groupByExtra = '';
    let orderByPrefix = '';

    if (groupMode === 'account') {
      selectExtra = `c.customer_account_id, c.customer_account_name,`;
      groupByExtra = ', c.customer_account_id, c.customer_account_name';
      orderByPrefix = 'c.customer_account_name, ';
    } else if (groupMode === 'campaign') {
      selectExtra = `c.customer_account_id, c.customer_account_name, c.name AS campaign_name,`;
      groupByExtra = ', c.customer_account_id, c.customer_account_name, c.name';
      orderByPrefix = 'c.customer_account_name, c.name, ';
    }

    const sql = `
      SELECT
        ${selectExtra}
        kw.keyword_text,
        ${EnumMappingService.getMatchTypeCaseSQL('kw.match_type')} AS match_type,
        ROUND(AVG(kw.quality_score), 1) AS avg_quality_score,
        SUM(kw.clicks) AS total_clicks,
        SUM(kw.impressions) AS total_impressions,
        SUM(kw.cost) AS total_cost,
        SUM(kw.conversions) AS total_conversions,
        CASE WHEN SUM(kw.clicks) > 0
          THEN ROUND(SUM(kw.cost) / SUM(kw.clicks), 2)
          ELSE 0
        END AS cpc,
        CASE WHEN SUM(kw.impressions) > 0
          THEN ROUND((SUM(kw.clicks)::numeric / SUM(kw.impressions)) * 100, 2)
          ELSE 0
        END AS ctr,
        ${metricExpr} AS sort_value
      FROM google_ads_keyword_snapshots kw
      JOIN campaigns c ON c.id = kw.campaign_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY kw.keyword_text, kw.match_type${groupByExtra}
      ORDER BY ${orderByPrefix}sort_value DESC
      LIMIT $${paramIdx}
    `;

    const result = await query(sql, values);
    return result.rows;
  }

  /**
   * Distribución de Quality Score de keywords.
   *
   * Clasifica keywords en 3 niveles según su Quality Score promedio:
   * - high: QS >= 7
   * - medium: QS >= 4
   * - low: QS < 4
   *
   * Subconsulta agrupa por keyword_text + match_type, calcula AVG(quality_score).
   * Consulta externa agrupa por quality_tier y suma clicks, cost, conversions.
   *
   * Tabla: google_ads_keyword_snapshots JOIN campaigns
   * Filtro: quality_score IS NOT NULL
   *
   * @param params.dateFrom   - Fecha inicio.
   * @param params.dateTo     - Fecha fin.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Array de {quality_tier, keyword_count, total_clicks, total_cost, total_conversions}.
   */
  async getKeywordQualityDistribution(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const conditions: string[] = ['kw.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;

    if (params.accountId) {
      conditions.push(`c.customer_account_id = $${paramIdx}`);
      values.push(params.accountId);
      paramIdx++;
    }
    paramIdx = this.addAccountIdsFilter(conditions, values, paramIdx, params.accountIds);
    if (params.countryId) {
      conditions.push(`c.country_id = $${paramIdx}`);
      values.push(params.countryId);
      paramIdx++;
    }

    const sql = `
      SELECT
        CASE
          WHEN avg_qs >= 7 THEN 'high'
          WHEN avg_qs >= 4 THEN 'medium'
          ELSE 'low'
        END AS quality_tier,
        COUNT(*) AS keyword_count,
        SUM(total_clicks) AS total_clicks,
        SUM(total_cost) AS total_cost,
        SUM(total_conversions) AS total_conversions
      FROM (
        SELECT
          kw.keyword_text,
          kw.match_type,
          AVG(kw.quality_score) AS avg_qs,
          SUM(kw.clicks) AS total_clicks,
          SUM(kw.cost) AS total_cost,
          SUM(kw.conversions) AS total_conversions
        FROM google_ads_keyword_snapshots kw
        JOIN campaigns c ON c.id = kw.campaign_id
        WHERE ${conditions.join(' AND ')} AND kw.quality_score IS NOT NULL
        GROUP BY kw.keyword_text, kw.match_type
      ) sub
      GROUP BY quality_tier
      ORDER BY quality_tier
    `;

    const result = await query(sql, values);
    return result.rows;
  }

  // ========== Device Analysis ==========

  /**
   * Rendimiento por dispositivo (Desktop, Mobile, Tablet, etc.).
   *
   * Tabla: google_ads_device_snapshots JOIN campaigns
   * Usa EnumMappingService.getDeviceCaseSQL() para traducir código numérico a nombre.
   * Métricas: total_clicks, total_impressions, total_cost, total_conversions,
   * CPC = cost/clicks, CTR = (clicks/impressions)×100,
   * conversion_rate = (conversions/clicks)×100.
   *
   * @param params.dateFrom   - Fecha inicio.
   * @param params.dateTo     - Fecha fin.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Array de filas por dispositivo con métricas agregadas.
   */
  async getDeviceBreakdown(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const conditions: string[] = ['ds.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;

    if (params.accountId) {
      conditions.push(`c.customer_account_id = $${paramIdx}`);
      values.push(params.accountId);
      paramIdx++;
    }
    paramIdx = this.addAccountIdsFilter(conditions, values, paramIdx, params.accountIds);
    if (params.countryId) {
      conditions.push(`c.country_id = $${paramIdx}`);
      values.push(params.countryId);
      paramIdx++;
    }

    const sql = `
      SELECT
        ${EnumMappingService.getDeviceCaseSQL('ds.device')} AS device,
        SUM(ds.clicks) AS total_clicks,
        SUM(ds.impressions) AS total_impressions,
        SUM(ds.cost) AS total_cost,
        SUM(ds.conversions) AS total_conversions,
        CASE WHEN SUM(ds.clicks) > 0
          THEN ROUND(SUM(ds.cost) / SUM(ds.clicks), 2)
          ELSE 0
        END AS cpc,
        CASE WHEN SUM(ds.impressions) > 0
          THEN ROUND((SUM(ds.clicks)::numeric / SUM(ds.impressions)) * 100, 2)
          ELSE 0
        END AS ctr,
        CASE WHEN SUM(ds.cost) > 0
          THEN ROUND((SUM(ds.conversions)::numeric / SUM(ds.cost)) * 100, 2)
          ELSE 0
        END AS conv_rate
      FROM google_ads_device_snapshots ds
      JOIN campaigns c ON c.id = ds.campaign_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY ds.device
      ORDER BY total_cost DESC
    `;

    const result = await query(sql, values);
    return result.rows;
  }

  // ========== Geographic Analysis ==========

  /**
   * Rendimiento geográfico.
   *
   * Tabla: google_ads_geo_snapshots JOIN campaigns
   * Agrupa por geo_target_name y geo_target_type (Country, Region, City, etc.).
   * Métricas: total_clicks, total_impressions, total_cost, total_conversions, CPC, CTR.
   * Ordenado por total_cost DESC con LIMIT configurable (default 20).
   *
   * @param params.dateFrom   - Fecha inicio.
   * @param params.dateTo     - Fecha fin.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @param params.limit      - Cantidad máxima de resultados (default 20).
   * @returns Array de filas por ubicación geográfica con métricas.
   */
  async getGeoPerformance(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
    limit?: number;
  }) {
    const conditions: string[] = ['gs.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;

    if (params.accountId) {
      conditions.push(`c.customer_account_id = $${paramIdx}`);
      values.push(params.accountId);
      paramIdx++;
    }
    paramIdx = this.addAccountIdsFilter(conditions, values, paramIdx, params.accountIds);
    if (params.countryId) {
      conditions.push(`c.country_id = $${paramIdx}`);
      values.push(params.countryId);
      paramIdx++;
    }

    const limitVal = params.limit || 20;
    values.push(limitVal);

    const geoName = this.geoNameSql('gs.geo_target_name', 'geo_target_name');
    const sql = `
      SELECT
        ${geoName},
        gs.geo_target_type,
        SUM(gs.clicks) AS total_clicks,
        SUM(gs.impressions) AS total_impressions,
        SUM(gs.cost) AS total_cost,
        SUM(gs.conversions) AS total_conversions,
        CASE WHEN SUM(gs.clicks) > 0
          THEN ROUND(SUM(gs.cost) / SUM(gs.clicks), 2)
          ELSE 0
        END AS cpc,
        CASE WHEN SUM(gs.impressions) > 0
          THEN ROUND((SUM(gs.clicks)::numeric / SUM(gs.impressions)) * 100, 2)
          ELSE 0
        END AS ctr,
        CASE WHEN SUM(gs.conversions) > 0
          THEN ROUND((SUM(gs.cost) / SUM(gs.conversions))::numeric, 2)
          ELSE 0
        END AS cpa
      FROM google_ads_geo_snapshots gs
      JOIN campaigns c ON c.id = gs.campaign_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY gs.geo_target_name, gs.geo_target_type
      ORDER BY total_cost DESC
      LIMIT $${paramIdx}
    `;

    const result = await query(sql, values);
    return result.rows;
  }

  /**
   * Rendimiento por localidad (regiones/ciudades) dentro de un país.
   * Usa google_ads_location_snapshots (synced from user_location_view).
   */
  async getLocationPerformance(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
    countryCriterionId?: string;
    limit?: number;
  }) {
    const conditions: string[] = ['ls.snapshot_date BETWEEN $1 AND $2'];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;

    if (params.accountId) {
      conditions.push(`c.customer_account_id = $${paramIdx}`);
      values.push(params.accountId);
      paramIdx++;
    }
    paramIdx = this.addAccountIdsFilter(conditions, values, paramIdx, params.accountIds);
    if (params.countryId) {
      conditions.push(`c.country_id = $${paramIdx}`);
      values.push(params.countryId);
      paramIdx++;
    }
    if (params.countryCriterionId) {
      conditions.push(`ls.country_criterion_id = $${paramIdx}`);
      values.push(params.countryCriterionId);
      paramIdx++;
    }

    const limitVal = params.limit || 50;
    values.push(limitVal);

    const sql = `
      SELECT
        ls.location_name,
        ls.location_type,
        ls.country_name,
        ls.country_criterion_id,
        SUM(ls.clicks) AS total_clicks,
        SUM(ls.impressions) AS total_impressions,
        SUM(ls.cost) AS total_cost,
        SUM(ls.conversions) AS total_conversions,
        CASE WHEN SUM(ls.clicks) > 0
          THEN ROUND(SUM(ls.cost) / SUM(ls.clicks), 2)
          ELSE 0
        END AS cpc,
        CASE WHEN SUM(ls.impressions) > 0
          THEN ROUND((SUM(ls.clicks)::numeric / SUM(ls.impressions)) * 100, 2)
          ELSE 0
        END AS ctr,
        CASE WHEN SUM(ls.conversions) > 0
          THEN ROUND((SUM(ls.cost) / SUM(ls.conversions))::numeric, 2)
          ELSE 0
        END AS cpa
      FROM google_ads_location_snapshots ls
      JOIN campaigns c ON c.id = ls.campaign_id
      WHERE ${conditions.join(' AND ')}
        AND ls.location_name NOT LIKE 'Loc:%'
      GROUP BY ls.location_name, ls.location_type, ls.country_name, ls.country_criterion_id
      ORDER BY total_cost DESC
      LIMIT $${paramIdx}
    `;

    const result = await query(sql, values);
    return result.rows;
  }

  /**
   * Datos para mapa geográfico.
   *
   * Similar a getGeoPerformance pero agrega métricas adicionales:
   * - CPA = cost / conversions
   * - conversion_rate = (conversions / clicks) × 100
   * - Porcentajes relativos: cost_pct, clicks_pct, impressions_pct
   *   (calculados en JS dividiendo cada fila entre totales globales).
   *
   * Tabla: google_ads_geo_snapshots JOIN campaigns
   *
   * @param params.dateFrom   - Fecha inicio.
   * @param params.dateTo     - Fecha fin.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @param params.metric     - (Opcional) Métrica para ordenar.
   * @returns Array de filas geográficas con métricas y porcentajes relativos.
   */
  async getGeoMapData(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
    metric?: string;
  }) {
    const conditions: string[] = ['gs.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;

    if (params.accountId) {
      conditions.push(`c.customer_account_id = $${paramIdx}`);
      values.push(params.accountId);
      paramIdx++;
    }
    paramIdx = this.addAccountIdsFilter(conditions, values, paramIdx, params.accountIds);
    if (params.countryId) {
      conditions.push(`c.country_id = $${paramIdx}`);
      values.push(params.countryId);
      paramIdx++;
    }

    const geoNameMap = this.geoNameSql('gs.geo_target_name', 'country');
    const sql = `
      SELECT
        ${geoNameMap},
        gs.geo_target_type,
        SUM(gs.clicks)::int AS clicks,
        SUM(gs.impressions)::int AS impressions,
        SUM(gs.cost)::numeric AS total_cost,
        SUM(gs.conversions)::numeric AS total_conversions,
        CASE WHEN SUM(gs.clicks) > 0
          THEN ROUND(SUM(gs.cost) / SUM(gs.clicks), 2)
          ELSE 0
        END AS cpc,
        CASE WHEN SUM(gs.impressions) > 0
          THEN ROUND((SUM(gs.clicks)::numeric / SUM(gs.impressions)) * 100, 2)
          ELSE 0
        END AS ctr,
        CASE WHEN SUM(gs.conversions) > 0
          THEN ROUND((SUM(gs.cost) / SUM(gs.conversions))::numeric, 2)
          ELSE 0
        END AS cpa,
        CASE WHEN SUM(gs.clicks) > 0
          THEN ROUND((SUM(gs.conversions)::numeric / SUM(gs.clicks)) * 100, 2)
          ELSE 0
        END AS conversion_rate
      FROM google_ads_geo_snapshots gs
      JOIN campaigns c ON c.id = gs.campaign_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY gs.geo_target_name, gs.geo_target_type
      ORDER BY SUM(gs.cost) DESC
    `;

    const result = await query(sql, values);
    const rows = result.rows;

    // Calculate totals for percentage calculations
    const totals = rows.reduce((acc: any, r: any) => ({
      cost: acc.cost + Number(r.total_cost),
      clicks: acc.clicks + Number(r.clicks),
      impressions: acc.impressions + Number(r.impressions),
      conversions: acc.conversions + Number(r.total_conversions),
    }), { cost: 0, clicks: 0, impressions: 0, conversions: 0 });

    return rows.map((r: any) => ({
      ...r,
      cost_pct: totals.cost > 0 ? Number(((Number(r.total_cost) / totals.cost) * 100).toFixed(1)) : 0,
      clicks_pct: totals.clicks > 0 ? Number(((Number(r.clicks) / totals.clicks) * 100).toFixed(1)) : 0,
      impressions_pct: totals.impressions > 0 ? Number(((Number(r.impressions) / totals.impressions) * 100).toFixed(1)) : 0,
    }));
  }

  /**
   * Reporte de eficiencia por país.
   *
   * Score compuesto basado en rankings:
   *   efficiency_score = (1/cpa_rank × 40 + 1/ctr_rank × 30 + 1/conv_rank × 30) × 100
   *
   * Peso de cada componente:
   *   - CPA (menor es mejor):   40%
   *   - CTR (mayor es mejor):   30%
   *   - ConvRate (mayor es mejor): 30%
   *
   * CTE country_metrics: métricas por geo_target_name con CPC, CTR, CPA, conversion_rate.
   * CTE ranked: ROW_NUMBER() para cada métrica.
   * SELECT final: calcula efficiency_score.
   *
   * Tabla: google_ads_geo_snapshots JOIN campaigns
   * Filtro: SUM(cost) > 0
   *
   * @param params.dateFrom   - Fecha inicio.
   * @param params.dateTo     - Fecha fin.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Array de países con métricas, rankings y efficiency_score, ordenado DESC.
   */
  async getCountryEfficiencyReport(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const conditions: string[] = ['gs.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;

    if (params.accountId) {
      conditions.push(`c.customer_account_id = $${paramIdx}`);
      values.push(params.accountId);
      paramIdx++;
    }
    paramIdx = this.addAccountIdsFilter(conditions, values, paramIdx, params.accountIds);
    if (params.countryId) {
      conditions.push(`c.country_id = $${paramIdx}`);
      values.push(params.countryId);
      paramIdx++;
    }

    const geoNameEff = this.geoNameSql('gs.geo_target_name', 'country_name');
    const sql = `
      WITH country_metrics AS (
        SELECT
          ${geoNameEff},
          COUNT(DISTINCT c.customer_account_id)::int AS account_count,
          COUNT(DISTINCT c.id)::int AS campaigns_count,
          SUM(gs.cost)::numeric AS total_cost,
          SUM(gs.clicks)::int AS total_clicks,
          SUM(gs.impressions)::int AS total_impressions,
          SUM(gs.conversions)::numeric AS total_conversions,
          CASE WHEN SUM(gs.clicks) > 0
            THEN ROUND(SUM(gs.cost) / SUM(gs.clicks), 2) ELSE 0 END AS cpc,
          CASE WHEN SUM(gs.impressions) > 0
            THEN ROUND((SUM(gs.clicks)::numeric / SUM(gs.impressions)) * 100, 2) ELSE 0 END AS ctr,
          CASE WHEN SUM(gs.conversions) > 0
            THEN ROUND((SUM(gs.cost) / SUM(gs.conversions))::numeric, 2) ELSE 0 END AS cpa,
          CASE WHEN SUM(gs.clicks) > 0
            THEN ROUND((SUM(gs.conversions)::numeric / SUM(gs.clicks)) * 100, 2) ELSE 0 END AS conversion_rate
        FROM google_ads_geo_snapshots gs
        JOIN campaigns c ON c.id = gs.campaign_id
        WHERE ${conditions.join(' AND ')}
        GROUP BY gs.geo_target_name
        HAVING SUM(gs.cost) > 0
      ),
      ranked AS (
        SELECT *,
          ROW_NUMBER() OVER (ORDER BY cpa ASC NULLS LAST) AS cpa_rank,
          ROW_NUMBER() OVER (ORDER BY ctr DESC) AS ctr_rank,
          ROW_NUMBER() OVER (ORDER BY conversion_rate DESC) AS conv_rank
        FROM country_metrics
      )
      SELECT *,
        ROUND((
          (1.0 / GREATEST(cpa_rank, 1)) * 40 +
          (1.0 / GREATEST(ctr_rank, 1)) * 30 +
          (1.0 / GREATEST(conv_rank, 1)) * 30
        ) * 100, 1) AS efficiency_score
      FROM ranked
      ORDER BY efficiency_score DESC
    `;

    const result = await query(sql, values);
    return result.rows;
  }

  // ========== Budget Intelligence ==========

  /**
   * Pacing de presupuesto por cuenta.
   *
   * Fórmulas principales:
   * - pacing_pct = (total_cost / (total_daily_budget × days_with_data)) × 100
   * - daily_run_rate = total_cost / days_with_data
   * - projected_monthly_spend = daily_run_rate × 30
   *
   * Genera recomendación en español según umbral de pacing:
   *   <50% → "Sub-ejecución severa"
   *   <80% → "Baja ejecución"
   *   80-110% → "Ritmo óptimo"
   *   >110% → "Sobre-ejecución"
   *
   * CTEs: campaign_data → account_budgets → account_metrics → with_recommendations
   * Tablas: google_ads_snapshots, campaigns, countries
   *
   * @param params.dateFrom   - Fecha inicio.
   * @param params.dateTo     - Fecha fin.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Array de cuentas con pacing_pct, daily_run_rate, projected_monthly_spend
   *          y pacing_recommendation.
   */
  async getBudgetPacing(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const conditions: string[] = ['gs.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;

    if (params.accountId) {
      conditions.push(`c.customer_account_id = $${paramIdx}`);
      values.push(params.accountId);
      paramIdx++;
    }
    paramIdx = this.addAccountIdsFilter(conditions, values, paramIdx, params.accountIds);
    if (params.countryId) {
      conditions.push(`c.country_id = $${paramIdx}`);
      values.push(params.countryId);
      paramIdx++;
    }

    const sql = `
      WITH campaign_data AS (
        SELECT
          c.id,
          c.customer_account_id,
          c.daily_budget,
          SUM(gs.cost) AS total_cost,
          SUM(gs.conversions) AS total_conversions,
          SUM(gs.clicks) AS total_clicks,
          COUNT(DISTINCT gs.snapshot_date) AS days_with_data
        FROM google_ads_snapshots gs
        JOIN campaigns c ON c.id = gs.campaign_id
        WHERE ${conditions.join(' AND ')}
        GROUP BY c.id, c.customer_account_id, c.daily_budget
      ),
      account_budgets AS (
        SELECT
          customer_account_id,
          SUM(COALESCE(daily_budget, 0)) AS total_daily_budget,
          COUNT(DISTINCT id) AS active_campaigns,
          ROUND(AVG(COALESCE(daily_budget, 0))::numeric, 2) AS avg_campaign_budget,
          ROUND(AVG(CASE WHEN total_conversions > 0 AND total_cost > 0 THEN total_cost / total_conversions ELSE NULL END)::numeric, 2) AS avg_cpa,
          ROUND(AVG(CASE WHEN total_clicks > 0 AND total_cost > 0 THEN total_cost / total_clicks ELSE NULL END)::numeric, 4) AS avg_cpc
        FROM campaign_data
        GROUP BY customer_account_id
      ),
      account_metrics AS (
        SELECT
          c.customer_account_id,
          c.customer_account_name,
          co.name AS country_name,
          SUM(gs.cost) AS total_cost,
          SUM(gs.clicks) AS total_clicks,
          SUM(gs.conversions) AS total_conversions,
          COUNT(DISTINCT gs.snapshot_date) AS days_with_data,
          COUNT(DISTINCT c.id) AS campaigns_count,
          MIN(gs.snapshot_date) AS first_date,
          MAX(gs.snapshot_date) AS last_date,
          COALESCE(ab.total_daily_budget, 0) AS total_daily_budget,
          COALESCE(ab.avg_cpa, 0) AS account_avg_cpa
        FROM google_ads_snapshots gs
        JOIN campaigns c ON c.id = gs.campaign_id
        LEFT JOIN countries co ON co.id = c.country_id
        LEFT JOIN account_budgets ab ON ab.customer_account_id = c.customer_account_id
        WHERE ${conditions.join(' AND ')}
        GROUP BY c.customer_account_id, c.customer_account_name, co.name, ab.total_daily_budget, ab.avg_cpa
      ),
      with_recommendations AS (
        SELECT
          customer_account_id,
          customer_account_name,
          country_name,
          total_cost,
          total_daily_budget,
          days_with_data,
          campaigns_count,
          first_date,
          last_date,
          total_clicks,
          total_conversions,
          account_avg_cpa,
          CASE WHEN total_daily_budget > 0 AND days_with_data > 0
            THEN ROUND((total_cost / (total_daily_budget * days_with_data)) * 100, 2)
            ELSE 0
          END AS pacing_pct,
          CASE WHEN days_with_data > 0
            THEN ROUND(total_cost / days_with_data, 2)
            ELSE 0
          END AS daily_run_rate,
          CASE WHEN days_with_data > 0
            THEN ROUND((total_cost / days_with_data) * 30, 2)
            ELSE 0
          END AS projected_monthly_spend,
          -- Budget recommendation targeting 100% pacing
          -- Formula: ideal budget = actual daily spend (run rate), so pacing becomes ~100%
          CASE
            WHEN total_daily_budget = 0 THEN 0
            WHEN days_with_data = 0 THEN total_daily_budget
            ELSE ROUND((total_cost / days_with_data)::numeric, 0)
          END AS recommended_daily_budget
        FROM account_metrics
      )
      SELECT
        customer_account_id,
        customer_account_name,
        country_name,
        total_cost,
        total_daily_budget,
        days_with_data,
        campaigns_count,
        first_date,
        last_date,
        pacing_pct,
        daily_run_rate,
        projected_monthly_spend,
        recommended_daily_budget,
        CASE
          WHEN recommended_daily_budget > total_daily_budget THEN
            'Aumentar +' || ROUND(((recommended_daily_budget - total_daily_budget) / NULLIF(total_daily_budget, 0)) * 100) || '%'
          WHEN recommended_daily_budget < total_daily_budget THEN
            'Reducir ' || ROUND(((recommended_daily_budget - total_daily_budget) / NULLIF(total_daily_budget, 0)) * 100) || '%'
          ELSE 'Mantener'
        END AS budget_status,
        ROUND((recommended_daily_budget - total_daily_budget)::numeric, 0) AS budget_adjustment,
        -- Pacing recommendation text for 100% target
        CASE
          WHEN pacing_pct = 0 THEN 'Sin datos de gasto. Verificar que las campanas esten activas.'
          WHEN pacing_pct < 50 THEN 'Pacing critico (' || pacing_pct || '%). Se esta gastando menos de la mitad del presupuesto. Reducir presupuesto diario a ' || recommended_daily_budget || ' o revisar restricciones de segmentacion/pujas.'
          WHEN pacing_pct < 70 THEN 'Sub-ejecucion (' || pacing_pct || '%). Reducir presupuesto diario a ' || recommended_daily_budget || ' o ampliar audiencias/keywords para generar mas impresiones.'
          WHEN pacing_pct < 90 THEN 'Pacing bajo (' || pacing_pct || '%). Ajustar presupuesto a ' || recommended_daily_budget || ' o incrementar pujas 10-15% para mejorar competitividad.'
          WHEN pacing_pct <= 110 THEN 'Pacing optimo (' || pacing_pct || '%). El presupuesto se esta consumiendo correctamente. Mantener configuracion actual.'
          WHEN pacing_pct <= 130 THEN 'Sobre-ejecucion leve (' || pacing_pct || '%). Aumentar presupuesto a ' || recommended_daily_budget || ' para evitar limitaciones de entrega.'
          ELSE 'Sobre-ejecucion alta (' || pacing_pct || '%). Aumentar presupuesto a ' || recommended_daily_budget || ' urgentemente o reducir pujas para controlar el gasto.'
        END AS pacing_recommendation
      FROM with_recommendations
      WHERE total_daily_budget > 0
      ORDER BY total_cost DESC
    `;

    const result = await query(sql, values);
    return result.rows;
  }

  /**
   * Detección de desperdicio (waste) en campañas.
   *
   * Identifica dos tipos de desperdicio:
   * - ZERO_CONVERSIONS: campañas con gasto > 0 pero 0 conversiones.
   *   wasted_spend = total_cost de la campaña.
   * - HIGH_CPA: campañas con CPA > 2× promedio global.
   *   wasted_spend = total_cost - (conversions × avg_cpa global).
   *
   * CTEs: campaign_metrics (métricas por campaña), avg_cpa (promedio global).
   * Tablas: google_ads_snapshots JOIN campaigns LEFT JOIN countries
   *
   * @param params.dateFrom   - Fecha inicio.
   * @param params.dateTo     - Fecha fin.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Array de campañas con waste_reason y wasted_spend, ordenado DESC.
   */
  async getWasteDetection(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const conditions: string[] = ['gs.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;

    if (params.accountId) {
      conditions.push(`c.customer_account_id = $${paramIdx}`);
      values.push(params.accountId);
      paramIdx++;
    }
    paramIdx = this.addAccountIdsFilter(conditions, values, paramIdx, params.accountIds);
    if (params.countryId) {
      conditions.push(`c.country_id = $${paramIdx}`);
      values.push(params.countryId);
      paramIdx++;
    }

    const sql = `
      WITH campaign_metrics AS (
        SELECT
          c.id AS campaign_id,
          c.name AS campaign_name,
          c.customer_account_id,
          c.customer_account_name,
          co.name AS country_name,
          SUM(gs.cost) AS total_cost,
          SUM(gs.clicks) AS total_clicks,
          SUM(gs.conversions) AS total_conversions,
          CASE WHEN SUM(gs.conversions) > 0
            THEN ROUND(SUM(gs.cost) / SUM(gs.conversions), 2)
            ELSE NULL
          END AS cpa
        FROM google_ads_snapshots gs
        JOIN campaigns c ON c.id = gs.campaign_id
        LEFT JOIN countries co ON co.id = c.country_id
        WHERE ${conditions.join(' AND ')}
        GROUP BY c.id, c.name, c.customer_account_id, c.customer_account_name, co.name
        HAVING SUM(gs.cost) > 0
      ),
      avg_cpa AS (
        SELECT ROUND(AVG(cpa), 2) AS global_avg_cpa FROM campaign_metrics WHERE cpa IS NOT NULL
      )
      SELECT
        cm.campaign_id,
        cm.campaign_name,
        cm.customer_account_id,
        cm.customer_account_name,
        cm.country_name,
        cm.total_cost,
        cm.total_clicks,
        cm.total_conversions,
        cm.cpa,
        ac.global_avg_cpa,
        CASE
          WHEN cm.total_conversions = 0 THEN 'ZERO_CONVERSIONS'
          WHEN cm.cpa > ac.global_avg_cpa * 2 THEN 'HIGH_CPA'
          ELSE NULL
        END AS waste_reason,
        CASE
          WHEN cm.total_conversions = 0 THEN cm.total_cost
          WHEN cm.cpa > ac.global_avg_cpa * 2 THEN ROUND(cm.total_cost - (cm.total_conversions * ac.global_avg_cpa), 2)
          ELSE 0
        END AS wasted_spend
      FROM campaign_metrics cm
      CROSS JOIN avg_cpa ac
      WHERE cm.total_conversions = 0 OR cm.cpa > ac.global_avg_cpa * 2
      ORDER BY wasted_spend DESC
    `;

    const result = await query(sql, values);
    return result.rows;
  }

  /**
   * Horario óptimo para anuncios.
   *
   * Tabla: google_ads_hourly_snapshots JOIN campaigns
   * Agrupa por hour_of_day y día de semana (EXTRACT(ISODOW) → 1=Lunes..7=Domingo).
   * Calcula por slot horario:
   * - total_clicks, total_cost, total_conversions
   * - CPA = cost / conversions
   * - conversion_rate = (conversions / clicks) × 100
   *
   * @param params.dateFrom   - Fecha inicio.
   * @param params.dateTo     - Fecha fin.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Array de slots {hour_of_day, day_of_week, total_clicks, cpa, conversion_rate}.
   */
  async getOptimalSchedule(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const conditions: string[] = ['hs.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;

    if (params.accountId) {
      conditions.push(`c.customer_account_id = $${paramIdx}`);
      values.push(params.accountId);
      paramIdx++;
    }
    paramIdx = this.addAccountIdsFilter(conditions, values, paramIdx, params.accountIds);
    if (params.countryId) {
      conditions.push(`c.country_id = $${paramIdx}`);
      values.push(params.countryId);
      paramIdx++;
    }

    const sql = `
      SELECT
        hs.hour_of_day,
        EXTRACT(ISODOW FROM hs.snapshot_date) AS day_of_week,
        SUM(hs.clicks) AS total_clicks,
        SUM(hs.cost) AS total_cost,
        SUM(hs.conversions) AS total_conversions,
        CASE WHEN SUM(hs.conversions) > 0
          THEN ROUND(SUM(hs.cost) / SUM(hs.conversions), 2)
          ELSE NULL
        END AS cpa,
        CASE WHEN SUM(hs.clicks) > 0
          THEN ROUND((SUM(hs.conversions)::numeric / SUM(hs.clicks)) * 100, 2)
          ELSE 0
        END AS conversion_rate
      FROM google_ads_hourly_snapshots hs
      JOIN campaigns c ON c.id = hs.campaign_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY hs.hour_of_day, EXTRACT(ISODOW FROM hs.snapshot_date)
      ORDER BY day_of_week, hs.hour_of_day
    `;

    const result = await query(sql, values);
    return result.rows;
  }

  /**
   * Forecast de presupuesto a 30 días.
   *
   * Usa modelo Holt-Winters con estacionalidad semanal (periodo=7) y horizonte de 30 días.
   * Si no hay suficientes datos (<14 puntos), hace fallback a SMA (Simple Moving Average).
   *
   * Retorna:
   * - trend: filas históricas filtradas al rango de fechas solicitado
   * - forecast.projected_7d / _14d / _30d: gasto proyectado acumulado
   * - forecast.ci80_* / ci95_*: intervalos de confianza al 80% y 95%
   * - forecast.seasonal_pattern: patrón estacional semanal (7 valores)
   * - forecast.model_quality: {rmse, mape, model_type}
   * - daily_forecast: array de proyecciones diarias para gráficos frontend
   *
   * Tabla: google_ads_snapshots JOIN campaigns
   * Dependencia: fitHoltWinters(), simpleMovingAverageForecast() de ml-analytics.service.ts
   *
   * @param params.dateFrom   - Fecha inicio (para filtrar vista, no el modelo).
   * @param params.dateTo     - Fecha fin.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Objeto {trend, scope_label, forecast, daily_forecast}.
   */
  async getBudgetForecast(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    // Pull ALL history for the model, but return trend rows within date range
    const conditions: string[] = ["c.ads_status = 'ENABLED'"];
    const values: any[] = [];
    let paramIdx = 1;

    if (params.accountId) {
      conditions.push(`c.customer_account_id = $${paramIdx}`);
      values.push(params.accountId);
      paramIdx++;
    }
    paramIdx = this.addAccountIdsFilter(conditions, values, paramIdx, params.accountIds);
    if (params.countryId) {
      conditions.push(`c.country_id = $${paramIdx}`);
      values.push(params.countryId);
      paramIdx++;
    }

    const sql = `
      SELECT
        gs.snapshot_date AS date,
        SUM(gs.cost) AS daily_cost,
        SUM(COALESCE(gs.daily_budget, 0)) AS daily_budget
      FROM google_ads_snapshots gs
      JOIN campaigns c ON c.id = gs.campaign_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY gs.snapshot_date
      ORDER BY gs.snapshot_date ASC
    `;

    const result = await query(sql, values);
    const allRows = result.rows;

    if (allRows.length < 3) {
      return { trend: allRows, forecast: null };
    }

    const costSeries = allRows.map((r: any) => Number(r.daily_cost) || 0);
    const n = costSeries.length;

    // Holt-Winters forecasting (weekly seasonality, 30-day horizon)
    const hw = fitHoltWinters(costSeries, 7, 30);

    let projected7d: number, projected14d: number, projected30d: number;
    let dailyForecast: any[] = [];
    let seasonalPattern: number[] | null = null;
    let modelQuality: any = null;
    let ci80_7d: any = null, ci80_14d: any = null, ci80_30d: any = null;
    let ci95_7d: any = null, ci95_14d: any = null, ci95_30d: any = null;

    if (hw) {
      // Sum daily forecasts for projected totals
      projected7d = Math.max(0, round2(hw.forecast.slice(0, 7).reduce((s, v) => s + v, 0)));
      projected14d = Math.max(0, round2(hw.forecast.slice(0, 14).reduce((s, v) => s + v, 0)));
      projected30d = Math.max(0, round2(hw.forecast.slice(0, 30).reduce((s, v) => s + v, 0)));

      // Confidence intervals (sum lower/upper bounds per horizon)
      ci80_7d = { lower: round2(sumArr(hw.forecastCI80.slice(0, 7).map(c => c.lower))), upper: round2(sumArr(hw.forecastCI80.slice(0, 7).map(c => c.upper))) };
      ci80_14d = { lower: round2(sumArr(hw.forecastCI80.slice(0, 14).map(c => c.lower))), upper: round2(sumArr(hw.forecastCI80.slice(0, 14).map(c => c.upper))) };
      ci80_30d = { lower: round2(sumArr(hw.forecastCI80.slice(0, 30).map(c => c.lower))), upper: round2(sumArr(hw.forecastCI80.slice(0, 30).map(c => c.upper))) };
      ci95_7d = { lower: round2(sumArr(hw.forecastCI95.slice(0, 7).map(c => c.lower))), upper: round2(sumArr(hw.forecastCI95.slice(0, 7).map(c => c.upper))) };
      ci95_14d = { lower: round2(sumArr(hw.forecastCI95.slice(0, 14).map(c => c.lower))), upper: round2(sumArr(hw.forecastCI95.slice(0, 14).map(c => c.upper))) };
      ci95_30d = { lower: round2(sumArr(hw.forecastCI95.slice(0, 30).map(c => c.lower))), upper: round2(sumArr(hw.forecastCI95.slice(0, 30).map(c => c.upper))) };

      seasonalPattern = hw.seasonalPattern.map(v => round3(v));
      modelQuality = { rmse: round2(hw.rmse), mape: round2(hw.mape), model_type: hw.modelType };

      // Daily forecast array for frontend charting
      const lastDate = new Date(allRows[n - 1].date);
      dailyForecast = hw.forecast.map((val, i) => {
        const d = new Date(lastDate);
        d.setDate(d.getDate() + i + 1);
        return {
          date: d.toISOString().split('T')[0],
          daily_cost: round2(val),
          ci80_lower: round2(hw.forecastCI80[i].lower),
          ci80_upper: round2(hw.forecastCI80[i].upper),
          ci95_lower: round2(hw.forecastCI95[i].lower),
          ci95_upper: round2(hw.forecastCI95[i].upper),
        };
      });
    } else {
      // Fallback: simple moving average for small datasets
      const sma = simpleMovingAverageForecast(costSeries, 7, 30);
      projected7d = round2(sma.forecast.slice(0, 7).reduce((s, v) => s + v, 0));
      projected14d = round2(sma.forecast.slice(0, 14).reduce((s, v) => s + v, 0));
      projected30d = round2(sma.forecast.slice(0, 30).reduce((s, v) => s + v, 0));
      ci95_7d = { lower: round2(sumArr(sma.ci95.slice(0, 7).map(c => c.lower))), upper: round2(sumArr(sma.ci95.slice(0, 7).map(c => c.upper))) };
      ci95_14d = { lower: round2(sumArr(sma.ci95.slice(0, 14).map(c => c.lower))), upper: round2(sumArr(sma.ci95.slice(0, 14).map(c => c.upper))) };
      ci95_30d = { lower: round2(sumArr(sma.ci95.slice(0, 30).map(c => c.lower))), upper: round2(sumArr(sma.ci95.slice(0, 30).map(c => c.upper))) };
    }

    const avgDailyCost = costSeries.reduce((s, v) => s + v, 0) / n;

    // Scope label
    let scopeLabel = 'todas las cuentas';
    if (params.accountId) {
      const acctResult = await query(
        'SELECT DISTINCT customer_account_name FROM campaigns WHERE customer_account_id = $1 LIMIT 1',
        [params.accountId]
      );
      scopeLabel = acctResult.rows[0]?.customer_account_name || params.accountId;
    } else if (params.countryId) {
      const countryResult = await query('SELECT name FROM countries WHERE id = $1', [params.countryId]);
      scopeLabel = countryResult.rows[0]?.name || 'pais seleccionado';
    }

    // Filter trend rows to requested date range for display
    const trendRows = allRows.filter((r: any) => r.date >= params.dateFrom && r.date <= params.dateTo);

    return {
      trend: trendRows,
      scope_label: scopeLabel,
      forecast: {
        avg_daily_cost: round2(avgDailyCost),
        slope: hw ? round2(hw.trend) : round2((costSeries[n - 1] - costSeries[0]) / Math.max(n - 1, 1)),
        trend_direction: hw
          ? (hw.trend > 0.5 ? 'increasing' : hw.trend < -0.5 ? 'decreasing' : 'stable')
          : 'stable',
        projected_7d: projected7d,
        projected_14d: projected14d,
        projected_30d: projected30d,
        ci80_7d, ci80_14d, ci80_30d,
        ci95_7d, ci95_14d, ci95_30d,
        seasonal_pattern: seasonalPattern,
        model_quality: modelQuality,
        data_points: n,
      },
      daily_forecast: dailyForecast,
    };
  }

  /**
   * Redistribución de presupuesto entre campañas.
   *
   * Clasifica campañas en tres tiers según su CPA respecto al promedio global:
   * - high_performer: CPA <= 70% del promedio global (eficientes)
   * - low_performer: CPA >= 150% del promedio global, o sin conversiones
   * - average: el resto
   *
   * CTEs: campaign_perf (métricas por campaña), avg_cpa (promedio global).
   * Tablas: google_ads_snapshots JOIN campaigns LEFT JOIN countries
   *
   * @param params.dateFrom   - Fecha inicio.
   * @param params.dateTo     - Fecha fin.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Array de campañas con performance_tier, cpa, global_avg_cpa, ordenado por CPA ASC.
   */
  async getBudgetRedistribution(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const conditions: string[] = ['gs.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;

    if (params.accountId) {
      conditions.push(`c.customer_account_id = $${paramIdx}`);
      values.push(params.accountId);
      paramIdx++;
    }
    paramIdx = this.addAccountIdsFilter(conditions, values, paramIdx, params.accountIds);
    if (params.countryId) {
      conditions.push(`c.country_id = $${paramIdx}`);
      values.push(params.countryId);
      paramIdx++;
    }

    const sql = `
      WITH campaign_perf AS (
        SELECT
          c.id AS campaign_id,
          c.name AS campaign_name,
          c.customer_account_id,
          c.customer_account_name,
          co.name AS country_name,
          SUM(gs.cost) AS total_cost,
          SUM(gs.conversions) AS total_conversions,
          AVG(COALESCE(gs.daily_budget, 0)) AS avg_daily_budget,
          CASE WHEN SUM(gs.conversions) > 0
            THEN ROUND(SUM(gs.cost) / SUM(gs.conversions), 2)
            ELSE NULL
          END AS cpa,
          CASE WHEN SUM(gs.clicks) > 0
            THEN ROUND((SUM(gs.conversions)::numeric / SUM(gs.clicks)) * 100, 2)
            ELSE 0
          END AS conversion_rate
        FROM google_ads_snapshots gs
        JOIN campaigns c ON c.id = gs.campaign_id
        LEFT JOIN countries co ON co.id = c.country_id
        WHERE ${conditions.join(' AND ')}
        GROUP BY c.id, c.name, c.customer_account_id, c.customer_account_name, co.name
        HAVING SUM(gs.cost) > 0
      ),
      avg_cpa AS (
        SELECT COALESCE(AVG(cpa), 0) AS avg_cpa FROM campaign_perf WHERE cpa IS NOT NULL
      )
      SELECT
        cp.campaign_id,
        cp.campaign_name,
        cp.customer_account_id,
        cp.customer_account_name,
        cp.country_name,
        cp.total_cost,
        cp.total_conversions,
        cp.avg_daily_budget,
        cp.cpa,
        cp.conversion_rate,
        ac.avg_cpa AS global_avg_cpa,
        CASE
          WHEN cp.cpa IS NULL OR cp.cpa = 0 THEN 'low_performer'
          WHEN cp.cpa <= ac.avg_cpa * 0.7 THEN 'high_performer'
          WHEN cp.cpa >= ac.avg_cpa * 1.5 THEN 'low_performer'
          ELSE 'average'
        END AS performance_tier
      FROM campaign_perf cp
      CROSS JOIN avg_cpa ac
      ORDER BY cp.cpa ASC NULLS LAST
    `;

    const result = await query(sql, values);
    return result.rows;
  }

  // ========== Smart Budget Recommendations ==========

  /**
   * Recomendaciones inteligentes de presupuesto con estadísticos.
   *
   * Calcula percentiles (P25, P50, P75) y desviación estándar (σ) del CPA.
   * También obtiene IS perdida por presupuesto y conversion_value para ROI.
   *
   * Reglas de recomendación:
   * - 0 conversiones + ≥14 días → reducir -50%
   * - CPA < P25 + IS perdida > 10% → aumentar hasta +IS% (max 50%)
   * - CPA > P75 + 0.5σ → reducir presupuesto
   * - CPA < P50 + IS perdida > 0 → aumento moderado (max 30%)
   * - Si hay conversion_value: calcula ROI proyectado
   *
   * Tablas: google_ads_snapshots JOIN campaigns LEFT JOIN countries,
   *         account_conversion_config
   *
   * @param params.dateFrom   - Fecha inicio.
   * @param params.dateTo     - Fecha fin.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Array de campañas con recommendation, action, recommended_change_pct,
   *          stats (p25, p50, p75, stddev) y projected_roi.
   */
  async getSmartBudgetRecommendations(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const conditions: string[] = ['gs.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;

    if (params.accountId) {
      conditions.push(`c.customer_account_id = $${paramIdx}`);
      values.push(params.accountId);
      paramIdx++;
    }
    paramIdx = this.addAccountIdsFilter(conditions, values, paramIdx, params.accountIds);
    if (params.countryId) {
      conditions.push(`c.country_id = $${paramIdx}`);
      values.push(params.countryId);
      paramIdx++;
    }

    const sql = `
      WITH campaign_analysis AS (
        SELECT
          c.id AS campaign_id,
          c.name AS campaign_name,
          c.customer_account_id,
          c.customer_account_name,
          co.name AS country_name,
          c.daily_budget AS current_daily_budget,
          SUM(gs.cost) AS total_cost,
          SUM(gs.clicks) AS total_clicks,
          SUM(gs.impressions) AS total_impressions,
          SUM(gs.conversions) AS total_conversions,
          COUNT(DISTINCT gs.snapshot_date) AS days_with_data,
          CASE WHEN SUM(gs.conversions) > 0
            THEN ROUND(SUM(gs.cost) / SUM(gs.conversions), 2)
            ELSE NULL
          END AS current_cpa,
          CASE WHEN SUM(gs.impressions) > 0
            THEN ROUND((SUM(gs.clicks)::numeric / SUM(gs.impressions)) * 100, 2)
            ELSE 0
          END AS ctr,
          CASE WHEN SUM(gs.clicks) > 0
            THEN ROUND(SUM(gs.cost) / SUM(gs.clicks), 2)
            ELSE 0
          END AS cpc,
          AVG(gs.search_budget_lost_is) AS avg_budget_lost_is,
          AVG(gs.search_impression_share) AS avg_impression_share
        FROM google_ads_snapshots gs
        JOIN campaigns c ON c.id = gs.campaign_id
        LEFT JOIN countries co ON co.id = c.country_id
        WHERE ${conditions.join(' AND ')}
        GROUP BY c.id, c.name, c.customer_account_id, c.customer_account_name, co.name, c.daily_budget
        HAVING SUM(gs.cost) > 0
      ),
      statistical_thresholds AS (
        SELECT
          customer_account_id,
          PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY current_cpa) AS cpa_p25,
          PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY current_cpa) AS cpa_median,
          PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY current_cpa) AS cpa_p75,
          COALESCE(STDDEV(current_cpa), 0) AS cpa_stddev,
          AVG(current_cpa) AS cpa_mean,
          COUNT(*) AS campaigns_in_pool
        FROM campaign_analysis
        WHERE current_cpa IS NOT NULL
        GROUP BY customer_account_id
      ),
      conversion_config AS (
        SELECT customer_account_id, conversion_value
        FROM account_conversion_config
      )
      SELECT
        ca.campaign_id,
        ca.campaign_name,
        ca.customer_account_id,
        ca.customer_account_name,
        ca.country_name,
        ca.current_daily_budget,
        ca.total_cost,
        ca.total_clicks,
        ca.total_conversions,
        ca.current_cpa,
        ca.ctr,
        ca.cpc,
        ca.days_with_data,
        ca.avg_budget_lost_is,
        ca.avg_impression_share,
        st.cpa_p25,
        st.cpa_median,
        st.cpa_p75,
        st.cpa_stddev,
        -- Data-driven recommended budget
        CASE
          WHEN ca.total_conversions = 0 AND ca.days_with_data >= 14
            THEN ca.current_daily_budget * 0.5
          WHEN ca.total_conversions = 0 AND ca.days_with_data < 14
            THEN ca.current_daily_budget
          WHEN ca.current_cpa <= st.cpa_p25 AND COALESCE(ca.avg_budget_lost_is, 0) > 0.10
            THEN ca.current_daily_budget * (1 + LEAST(0.50, COALESCE(ca.avg_budget_lost_is, 0)))
          WHEN ca.current_cpa > st.cpa_p75 + 0.5 * st.cpa_stddev AND st.cpa_stddev > 0
            THEN ca.current_daily_budget * GREATEST(0.50,
              1 - LEAST(0.50, 0.15 * (ca.current_cpa - st.cpa_p75) / NULLIF(st.cpa_stddev, 0)))
          WHEN ca.current_cpa < st.cpa_median AND COALESCE(ca.avg_budget_lost_is, 0) > 0.05
            THEN ca.current_daily_budget * (1 + LEAST(0.30, COALESCE(ca.avg_budget_lost_is, 0) * 0.5))
          ELSE ca.current_daily_budget
        END AS recommended_daily_budget,
        -- Expected monthly conversions
        CASE WHEN ca.total_conversions > 0 AND ca.days_with_data > 0
          THEN ROUND((ca.total_conversions / ca.days_with_data) * 30, 0)
          ELSE 0
        END AS expected_monthly_conversions,
        -- ROI: only if conversion value is configured for this account
        CASE WHEN cc.conversion_value IS NOT NULL AND ca.total_cost > 0
          THEN ROUND(((ca.total_conversions * cc.conversion_value) / ca.total_cost), 2)
          ELSE NULL
        END AS projected_roi_multiplier,
        -- Data-driven recommendation reason
        CASE
          WHEN ca.total_conversions = 0 AND ca.days_with_data >= 14
            THEN 'Sin conversiones en 14+ dias - reducir presupuesto'
          WHEN ca.total_conversions = 0
            THEN 'Datos insuficientes - mantener y monitorear'
          WHEN ca.current_cpa <= st.cpa_p25 AND COALESCE(ca.avg_budget_lost_is, 0) > 0.10
            THEN 'Alto rendimiento (CPA en p25) + perdida de IS por presupuesto '
              || ROUND(COALESCE(ca.avg_budget_lost_is, 0) * 100) || '% - escalar'
          WHEN st.cpa_stddev > 0 AND ca.current_cpa > st.cpa_p75 + 0.5 * st.cpa_stddev
            THEN 'CPA por encima del p75 + 0.5 sigma - reducir gasto'
          WHEN ca.current_cpa < st.cpa_median AND COALESCE(ca.avg_budget_lost_is, 0) > 0.05
            THEN 'CPA debajo de mediana + oportunidad de IS - incrementar moderadamente'
          ELSE 'En objetivo - mantener presupuesto'
        END AS recommendation
      FROM campaign_analysis ca
      LEFT JOIN statistical_thresholds st ON st.customer_account_id = ca.customer_account_id
      LEFT JOIN conversion_config cc ON cc.customer_account_id = ca.customer_account_id
      ORDER BY ca.total_conversions DESC
    `;

    const result = await query(sql, values);
    return result.rows;
  }

  // ========== Hourly Heatmap ==========

  /**
   * Heatmap hora × día de semana.
   *
   * Agrupa la métrica elegida (clicks, conversions, cost, CPC) por:
   * - hour_of_day (0-23)
   * - day_of_week ISO (1=Lunes .. 7=Domingo)
   *
   * Tabla: google_ads_hourly_snapshots JOIN campaigns
   *
   * @param params.dateFrom   - Fecha inicio.
   * @param params.dateTo     - Fecha fin.
   * @param params.metric     - 'clicks' | 'conversions' | 'cost' | 'cpc' (default 'clicks').
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Array de {day_of_week, hour_of_day, value}.
   */
  async getHourlyHeatmap(params: {
    dateFrom: string;
    dateTo: string;
    metric?: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const metric = params.metric || 'clicks';
    const metricMap: Record<string, string> = {
      clicks: 'SUM(hs.clicks)',
      conversions: 'SUM(hs.conversions)',
      cost: 'SUM(hs.cost)',
      cpc: 'CASE WHEN SUM(hs.clicks) > 0 THEN ROUND(SUM(hs.cost) / SUM(hs.clicks), 2) ELSE 0 END',
    };
    const metricExpr = metricMap[metric] || metricMap['clicks'];

    const conditions: string[] = ['hs.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;

    if (params.accountId) {
      conditions.push(`c.customer_account_id = $${paramIdx}`);
      values.push(params.accountId);
      paramIdx++;
    }
    paramIdx = this.addAccountIdsFilter(conditions, values, paramIdx, params.accountIds);
    if (params.countryId) {
      conditions.push(`c.country_id = $${paramIdx}`);
      values.push(params.countryId);
      paramIdx++;
    }

    const sql = `
      SELECT
        EXTRACT(ISODOW FROM hs.snapshot_date) AS day_of_week,
        hs.hour_of_day,
        ${metricExpr} AS value
      FROM google_ads_hourly_snapshots hs
      JOIN campaigns c ON c.id = hs.campaign_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY EXTRACT(ISODOW FROM hs.snapshot_date), hs.hour_of_day
      ORDER BY day_of_week, hs.hour_of_day
    `;

    const result = await query(sql, values);
    return result.rows;
  }

  // ========== Temporal Comparison ==========

  /**
   * Comparación entre 2 periodos de fechas.
   *
   * Calcula métricas agregadas para cada periodo (period1 y period2):
   * cost, clicks, impressions, conversions, CPC, CPA, CTR.
   *
   * Luego calcula delta absoluto y % de cambio entre ambos periodos.
   * Fórmula delta: ((valor_periodo2 - valor_periodo1) / valor_periodo1) × 100
   *
   * Tablas: google_ads_snapshots JOIN campaigns
   *
   * @param params.dateFrom1  - Inicio del periodo 1.
   * @param params.dateTo1    - Fin del periodo 1.
   * @param params.dateFrom2  - Inicio del periodo 2.
   * @param params.dateTo2    - Fin del periodo 2.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Objeto con deltas por métrica: {cost, clicks, impressions, conversions, cpc, cpa, ctr}
   *          cada uno con {period1, period2, absolute_change, pct_change}.
   */
  async getTemporalComparison(params: {
    dateFrom1: string;
    dateTo1: string;
    dateFrom2: string;
    dateTo2: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const conditions1: string[] = ['gs.snapshot_date BETWEEN $1 AND $2'];
    const conditions2: string[] = ['gs.snapshot_date BETWEEN $3 AND $4'];
    const sharedConditions: string[] = [];
    const values: any[] = [params.dateFrom1, params.dateTo1, params.dateFrom2, params.dateTo2];
    let paramIdx = 5;

    if (params.accountId) {
      sharedConditions.push(`c.customer_account_id = $${paramIdx}`);
      values.push(params.accountId);
      paramIdx++;
    }
    if (params.countryId) {
      sharedConditions.push(`c.country_id = $${paramIdx}`);
      values.push(params.countryId);
      paramIdx++;
    }

    const shared = sharedConditions.length > 0 ? ' AND ' + sharedConditions.join(' AND ') : '';

    const sql = `
      WITH period1 AS (
        SELECT
          COALESCE(SUM(gs.cost), 0) AS cost,
          COALESCE(SUM(gs.clicks), 0) AS clicks,
          COALESCE(SUM(gs.impressions), 0) AS impressions,
          COALESCE(SUM(gs.conversions), 0) AS conversions,
          CASE WHEN SUM(gs.clicks) > 0 THEN SUM(gs.cost) / SUM(gs.clicks) ELSE 0 END AS cpc,
          CASE WHEN SUM(gs.conversions) > 0 THEN SUM(gs.cost) / SUM(gs.conversions) ELSE 0 END AS cpa,
          CASE WHEN SUM(gs.impressions) > 0 THEN (SUM(gs.clicks)::numeric / SUM(gs.impressions)::numeric) * 100 ELSE 0 END AS ctr
        FROM google_ads_snapshots gs
        JOIN campaigns c ON c.id = gs.campaign_id
        WHERE ${conditions1.join(' AND ')}${shared}
      ),
      period2 AS (
        SELECT
          COALESCE(SUM(gs.cost), 0) AS cost,
          COALESCE(SUM(gs.clicks), 0) AS clicks,
          COALESCE(SUM(gs.impressions), 0) AS impressions,
          COALESCE(SUM(gs.conversions), 0) AS conversions,
          CASE WHEN SUM(gs.clicks) > 0 THEN SUM(gs.cost) / SUM(gs.clicks) ELSE 0 END AS cpc,
          CASE WHEN SUM(gs.conversions) > 0 THEN SUM(gs.cost) / SUM(gs.conversions) ELSE 0 END AS cpa,
          CASE WHEN SUM(gs.impressions) > 0 THEN (SUM(gs.clicks)::numeric / SUM(gs.impressions)::numeric) * 100 ELSE 0 END AS ctr
        FROM google_ads_snapshots gs
        JOIN campaigns c ON c.id = gs.campaign_id
        WHERE ${conditions2.join(' AND ')}${shared}
      )
      SELECT
        p1.cost AS cost_1, p2.cost AS cost_2,
        p1.clicks AS clicks_1, p2.clicks AS clicks_2,
        p1.impressions AS impressions_1, p2.impressions AS impressions_2,
        p1.conversions AS conversions_1, p2.conversions AS conversions_2,
        p1.cpc AS cpc_1, p2.cpc AS cpc_2,
        p1.cpa AS cpa_1, p2.cpa AS cpa_2,
        p1.ctr AS ctr_1, p2.ctr AS ctr_2
      FROM period1 p1, period2 p2
    `;

    const result = await query(sql, values);
    const row = result.rows[0];
    if (!row) return null;

    const calcDelta = (v1: number, v2: number) => ({
      value_1: v1,
      value_2: v2,
      absolute: v2 - v1,
      percent: v1 > 0 ? ((v2 - v1) / v1) * 100 : 0,
    });

    return {
      cost: calcDelta(parseFloat(row.cost_1), parseFloat(row.cost_2)),
      clicks: calcDelta(parseInt(row.clicks_1), parseInt(row.clicks_2)),
      impressions: calcDelta(parseInt(row.impressions_1), parseInt(row.impressions_2)),
      conversions: calcDelta(parseFloat(row.conversions_1), parseFloat(row.conversions_2)),
      cpc: calcDelta(parseFloat(row.cpc_1), parseFloat(row.cpc_2)),
      cpa: calcDelta(parseFloat(row.cpa_1), parseFloat(row.cpa_2)),
      ctr: calcDelta(parseFloat(row.ctr_1), parseFloat(row.ctr_2)),
    };
  }

  // ========== CPA Analysis ==========

  /**
   * Análisis de CPA (Costo por Adquisición) por campaña.
   *
   * Calcula CPA = cost / conversions para cada campaña.
   * Ordenado por CPA ASC (las campañas más eficientes primero).
   * Solo incluye campañas con gasto > 0.
   *
   * Tablas: google_ads_snapshots JOIN campaigns
   *
   * @param params.dateFrom   - Fecha inicio.
   * @param params.dateTo     - Fecha fin.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Array de campañas con campaign_name, total_cost, total_conversions, cpa, cpc.
   */
  async getCPAAnalysis(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const conditions: string[] = ['gs.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;

    if (params.accountId) {
      conditions.push(`c.customer_account_id = $${paramIdx}`);
      values.push(params.accountId);
      paramIdx++;
    }
    paramIdx = this.addAccountIdsFilter(conditions, values, paramIdx, params.accountIds);
    if (params.countryId) {
      conditions.push(`c.country_id = $${paramIdx}`);
      values.push(params.countryId);
      paramIdx++;
    }

    const sql = `
      SELECT
        c.id AS campaign_id,
        c.name AS campaign_name,
        c.customer_account_name AS account_name,
        SUM(gs.cost) AS total_cost,
        SUM(gs.conversions) AS total_conversions,
        CASE WHEN SUM(gs.conversions) > 0 THEN SUM(gs.cost) / SUM(gs.conversions) ELSE 0 END AS cpa,
        SUM(gs.clicks) AS total_clicks,
        CASE WHEN SUM(gs.clicks) > 0 THEN SUM(gs.cost) / SUM(gs.clicks) ELSE 0 END AS cpc
      FROM google_ads_snapshots gs
      JOIN campaigns c ON c.id = gs.campaign_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY c.id, c.name, c.customer_account_name
      HAVING SUM(gs.cost) > 0
      ORDER BY cpa ASC
    `;

    const result = await query(sql, values);
    return result.rows;
  }

  // ========== Quality Score Trend ==========

  /**
   * Tendencia de Quality Score diario.
   *
   * Tabla: google_ads_keyword_snapshots JOIN campaigns
   * Filtra: quality_score IS NOT NULL AND quality_score > 0
   * Agrupa por snapshot_date.
   * Métricas: avg_quality_score (promedio), keyword_count (keywords con datos).
   *
   * @param params.dateFrom   - Fecha inicio.
   * @param params.dateTo     - Fecha fin.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Array de {snapshot_date, avg_quality_score, keyword_count}.
   */
  async getQualityScoreTrend(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const conditions: string[] = ['ks.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;

    if (params.accountId) {
      conditions.push(`c.customer_account_id = $${paramIdx}`);
      values.push(params.accountId);
      paramIdx++;
    }
    paramIdx = this.addAccountIdsFilter(conditions, values, paramIdx, params.accountIds);
    if (params.countryId) {
      conditions.push(`c.country_id = $${paramIdx}`);
      values.push(params.countryId);
      paramIdx++;
    }

    const sql = `
      SELECT
        ks.snapshot_date,
        ROUND(AVG(ks.quality_score)::numeric, 2) AS avg_quality_score,
        COUNT(DISTINCT ks.keyword_text) AS keyword_count
      FROM google_ads_keyword_snapshots ks
      JOIN campaigns c ON c.id = ks.campaign_id
      WHERE ${conditions.join(' AND ')}
        AND ks.quality_score IS NOT NULL
        AND ks.quality_score > 0
      GROUP BY ks.snapshot_date
      ORDER BY ks.snapshot_date
    `;

    const result = await query(sql, values);
    return result.rows;
  }

  // ========== CPC Trend ==========

  /**
   * Tendencia de CPC con regresión lineal simple.
   *
   * Consulta SQL: CPC diario = cost / clicks por snapshot_date.
   * Luego en JS aplica regresión lineal OLS (Ordinary Least Squares):
   *   slope = (n×ΣxiYi - ΣxiΣyi) / (n×Σxi² - (Σxi)²)
   *   intercept = (Σyi - slope×Σxi) / n
   *
   * Proyecta CPC a 30 días: projected_30d = intercept + slope × (n + 30)
   *
   * Tablas: google_ads_snapshots JOIN campaigns
   *
   * @param params.dateFrom   - Fecha inicio.
   * @param params.dateTo     - Fecha fin.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Objeto {trend: filas diarias, forecast: {slope, intercept, projected_30d}}.
   */
  async getCPCTrend(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const conditions: string[] = ['gs.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;

    if (params.accountId) {
      conditions.push(`c.customer_account_id = $${paramIdx}`);
      values.push(params.accountId);
      paramIdx++;
    }
    paramIdx = this.addAccountIdsFilter(conditions, values, paramIdx, params.accountIds);
    if (params.countryId) {
      conditions.push(`c.country_id = $${paramIdx}`);
      values.push(params.countryId);
      paramIdx++;
    }

    const sql = `
      SELECT
        gs.snapshot_date,
        SUM(gs.cost) AS total_cost,
        SUM(gs.clicks) AS total_clicks,
        CASE WHEN SUM(gs.clicks) > 0 THEN ROUND((SUM(gs.cost) / SUM(gs.clicks))::numeric, 4) ELSE 0 END AS cpc
      FROM google_ads_snapshots gs
      JOIN campaigns c ON c.id = gs.campaign_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY gs.snapshot_date
      ORDER BY gs.snapshot_date
    `;

    const result = await query(sql, values);
    const rows = result.rows;

    // Linear regression for CPC forecast
    const cpcValues = rows.map((r: any) => parseFloat(r.cpc));
    let slope = 0;
    let intercept = 0;
    const n = cpcValues.length;

    if (n >= 2) {
      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
      for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += cpcValues[i];
        sumXY += i * cpcValues[i];
        sumX2 += i * i;
      }
      const denom = n * sumX2 - sumX * sumX;
      if (denom !== 0) {
        slope = (n * sumXY - sumX * sumY) / denom;
        intercept = (sumY - slope * sumX) / n;
      }
    }

    return {
      trend: rows,
      forecast: {
        slope: parseFloat(slope.toFixed(6)),
        intercept: parseFloat(intercept.toFixed(4)),
        projected_30d: parseFloat((intercept + slope * (n + 30)).toFixed(4)),
      },
    };
  }

  // ========== Seasonality Patterns ==========

  /**
   * Patrones de estacionalidad por día de semana y por mes.
   *
   * Ejecuta 2 consultas:
   * 1. by_day_of_week: EXTRACT(DOW) → 0=Domingo..6=Sábado.
   *    Métricas promedio: avg_cost, avg_clicks, avg_impressions, avg_conversions, avg_cpc, avg_ctr.
   * 2. by_month: EXTRACT(MONTH).
   *    Mismas métricas promedio agrupadas por mes.
   *
   * Tablas: google_ads_snapshots JOIN campaigns
   *
   * @param params.dateFrom   - Fecha inicio.
   * @param params.dateTo     - Fecha fin.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Objeto {by_day_of_week: [...], by_month: [...]}.
   */
  async getSeasonalityPatterns(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const conditions: string[] = ['gs.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;

    if (params.accountId) {
      conditions.push(`c.customer_account_id = $${paramIdx}`);
      values.push(params.accountId);
      paramIdx++;
    }
    paramIdx = this.addAccountIdsFilter(conditions, values, paramIdx, params.accountIds);
    if (params.countryId) {
      conditions.push(`c.country_id = $${paramIdx}`);
      values.push(params.countryId);
      paramIdx++;
    }

    // By day of week
    const byDaySQL = `
      SELECT
        EXTRACT(DOW FROM gs.snapshot_date)::integer AS day_of_week,
        ROUND(AVG(gs.cost)::numeric, 2) AS avg_cost,
        ROUND(AVG(gs.clicks)::numeric, 1) AS avg_clicks,
        ROUND(AVG(gs.impressions)::numeric, 0) AS avg_impressions,
        ROUND(AVG(gs.conversions)::numeric, 2) AS avg_conversions,
        CASE WHEN SUM(gs.clicks) > 0 THEN ROUND((SUM(gs.cost) / SUM(gs.clicks))::numeric, 4) ELSE 0 END AS avg_cpc,
        CASE WHEN SUM(gs.impressions) > 0 THEN ROUND((SUM(gs.clicks)::numeric / SUM(gs.impressions)::numeric) * 100, 2) ELSE 0 END AS avg_ctr,
        COUNT(DISTINCT gs.snapshot_date) AS sample_days
      FROM google_ads_snapshots gs
      JOIN campaigns c ON c.id = gs.campaign_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY EXTRACT(DOW FROM gs.snapshot_date)
      ORDER BY day_of_week
    `;

    // By month
    const byMonthSQL = `
      SELECT
        EXTRACT(MONTH FROM gs.snapshot_date)::integer AS month,
        ROUND(AVG(gs.cost)::numeric, 2) AS avg_cost,
        ROUND(AVG(gs.clicks)::numeric, 1) AS avg_clicks,
        ROUND(AVG(gs.conversions)::numeric, 2) AS avg_conversions,
        CASE WHEN SUM(gs.clicks) > 0 THEN ROUND((SUM(gs.cost) / SUM(gs.clicks))::numeric, 4) ELSE 0 END AS avg_cpc,
        COUNT(DISTINCT gs.snapshot_date) AS sample_days
      FROM google_ads_snapshots gs
      JOIN campaigns c ON c.id = gs.campaign_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY EXTRACT(MONTH FROM gs.snapshot_date)
      ORDER BY month
    `;

    const [byDay, byMonth] = await Promise.all([
      query(byDaySQL, values),
      query(byMonthSQL, values),
    ]);

    return {
      by_day_of_week: byDay.rows,
      by_month: byMonth.rows,
    };
  }

  // ========== Search Terms ==========

  /**
   * Términos de búsqueda con métricas.
   *
   * Tabla: google_ads_search_term_snapshots JOIN campaigns
   * Métricas: clicks, impressions, cost, conversions, CTR, CPC, CPA, campaigns_count.
   * Ordenado por cost DESC. LIMIT configurable (default 100).
   *
   * @param params.dateFrom   - Fecha inicio.
   * @param params.dateTo     - Fecha fin.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @param params.limit      - Cantidad máxima de resultados (default 100).
   * @returns Array de search terms con métricas, ordenados por cost DESC.
   */
  async getSearchTerms(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
    limit?: number;
  }) {
    const conditions: string[] = ['st.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;

    if (params.accountId) {
      conditions.push(`c.customer_account_id = $${paramIdx}`);
      values.push(params.accountId);
      paramIdx++;
    }
    paramIdx = this.addAccountIdsFilter(conditions, values, paramIdx, params.accountIds);
    if (params.countryId) {
      conditions.push(`c.country_id = $${paramIdx}`);
      values.push(params.countryId);
      paramIdx++;
    }

    const limit = params.limit || 100;
    conditions.push(`1=1`); // placeholder

    const sql = `
      SELECT
        st.search_term,
        st.status,
        SUM(st.clicks) AS clicks,
        SUM(st.impressions) AS impressions,
        SUM(st.cost) AS cost,
        SUM(st.conversions) AS conversions,
        CASE WHEN SUM(st.impressions) > 0 THEN ROUND((SUM(st.clicks)::numeric / SUM(st.impressions)::numeric) * 100, 2) ELSE 0 END AS ctr,
        CASE WHEN SUM(st.clicks) > 0 THEN ROUND((SUM(st.cost) / SUM(st.clicks))::numeric, 4) ELSE 0 END AS cpc,
        CASE WHEN SUM(st.conversions) > 0 THEN ROUND((SUM(st.cost) / SUM(st.conversions))::numeric, 2) ELSE 0 END AS cpa,
        COUNT(DISTINCT c.id) AS campaigns_count
      FROM google_ads_search_term_snapshots st
      JOIN campaigns c ON c.id = st.campaign_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY st.search_term, st.status
      ORDER BY SUM(st.cost) DESC
      LIMIT ${limit}
    `;

    const result = await query(sql, values);
    return result.rows;
  }

  // ========== Negative Keyword Candidates ==========

  /**
   * Candidatos a keyword negativa.
   *
   * Identifica términos de búsqueda con gasto > 0 y exactamente 0 conversiones.
   * Estos términos están consumiendo presupuesto sin generar resultados.
   *
   * Tabla: google_ads_search_term_snapshots JOIN campaigns
   * HAVING: SUM(conversions) = 0 AND SUM(cost) > 0
   * Ordenado por wasted_cost DESC. Máximo 50 resultados.
   * Incluye campaign_names (STRING_AGG) donde aparece cada término.
   *
   * @param params.dateFrom   - Fecha inicio.
   * @param params.dateTo     - Fecha fin.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Array de {search_term, clicks, impressions, wasted_cost, campaigns_count, campaign_names}.
   */
  async getNegativeKeywordCandidates(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const conditions: string[] = ['st.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;

    if (params.accountId) {
      conditions.push(`c.customer_account_id = $${paramIdx}`);
      values.push(params.accountId);
      paramIdx++;
    }
    paramIdx = this.addAccountIdsFilter(conditions, values, paramIdx, params.accountIds);
    if (params.countryId) {
      conditions.push(`c.country_id = $${paramIdx}`);
      values.push(params.countryId);
      paramIdx++;
    }

    const sql = `
      SELECT
        st.search_term,
        SUM(st.clicks) AS clicks,
        SUM(st.impressions) AS impressions,
        SUM(st.cost) AS wasted_cost,
        SUM(st.conversions) AS conversions,
        COUNT(DISTINCT c.id) AS campaigns_count,
        STRING_AGG(DISTINCT c.name, ', ') AS campaign_names
      FROM google_ads_search_term_snapshots st
      JOIN campaigns c ON c.id = st.campaign_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY st.search_term
      HAVING SUM(st.conversions) = 0 AND SUM(st.cost) > 0
      ORDER BY SUM(st.cost) DESC
      LIMIT 50
    `;

    const result = await query(sql, values);
    return result.rows;
  }

  // ========== Long-Tail Analysis ==========

  /**
   * Análisis de cola larga (long-tail) de términos de búsqueda.
   *
   * Clasifica términos por número de palabras:
   * - head: 1-2 palabras (términos cortos, alto volumen)
   * - mid-tail: 3-4 palabras
   * - long-tail: 5+ palabras (más específicos, menor CPC usualmente)
   *
   * word_count = LENGTH(search_term) - LENGTH(REPLACE(search_term, ' ', '')) + 1
   *
   * Compara CPC y CPA promedio por categoría.
   * Tabla: google_ads_search_term_snapshots JOIN campaigns
   *
   * @param params.dateFrom   - Fecha inicio.
   * @param params.dateTo     - Fecha fin.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Array de {category, term_count, total_clicks, total_cost, avg_cpc, avg_cpa}.
   */
  async getLongTailAnalysis(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const conditions: string[] = ['st.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;

    if (params.accountId) {
      conditions.push(`c.customer_account_id = $${paramIdx}`);
      values.push(params.accountId);
      paramIdx++;
    }
    paramIdx = this.addAccountIdsFilter(conditions, values, paramIdx, params.accountIds);
    if (params.countryId) {
      conditions.push(`c.country_id = $${paramIdx}`);
      values.push(params.countryId);
      paramIdx++;
    }

    const sql = `
      WITH term_stats AS (
        SELECT
          st.search_term,
          LENGTH(st.search_term) - LENGTH(REPLACE(st.search_term, ' ', '')) + 1 AS word_count,
          SUM(st.clicks) AS clicks,
          SUM(st.impressions) AS impressions,
          SUM(st.cost) AS cost,
          SUM(st.conversions) AS conversions
        FROM google_ads_search_term_snapshots st
        JOIN campaigns c ON c.id = st.campaign_id
        WHERE ${conditions.join(' AND ')}
        GROUP BY st.search_term
      )
      SELECT
        CASE
          WHEN word_count <= 2 THEN 'head'
          WHEN word_count <= 4 THEN 'mid-tail'
          ELSE 'long-tail'
        END AS category,
        COUNT(*) AS term_count,
        SUM(clicks) AS total_clicks,
        SUM(impressions) AS total_impressions,
        SUM(cost) AS total_cost,
        SUM(conversions) AS total_conversions,
        CASE WHEN SUM(clicks) > 0 THEN ROUND((SUM(cost) / SUM(clicks))::numeric, 4) ELSE 0 END AS avg_cpc,
        CASE WHEN SUM(conversions) > 0 THEN ROUND((SUM(cost) / SUM(conversions))::numeric, 2) ELSE 0 END AS avg_cpa
      FROM term_stats
      GROUP BY CASE
        WHEN word_count <= 2 THEN 'head'
        WHEN word_count <= 4 THEN 'mid-tail'
        ELSE 'long-tail'
      END
      ORDER BY CASE
        WHEN CASE WHEN word_count <= 2 THEN 'head' WHEN word_count <= 4 THEN 'mid-tail' ELSE 'long-tail' END = 'head' THEN 1
        WHEN CASE WHEN word_count <= 2 THEN 'head' WHEN word_count <= 4 THEN 'mid-tail' ELSE 'long-tail' END = 'mid-tail' THEN 2
        ELSE 3
      END
    `;

    const result = await query(sql, values);
    return result.rows;
  }

  // ========== Keyword Cannibalization ==========

  /**
   * Detección de canibalización de keywords.
   *
   * Identifica keywords que aparecen en más de 1 campaña simultáneamente
   * (HAVING COUNT(DISTINCT campaign) > 1), lo cual indica que se compite
   * consigo mismo en las subastas de Google Ads.
   *
   * Tabla: google_ads_keyword_snapshots JOIN campaigns
   * Métricas: total_cost, total_clicks, total_conversions, campaigns_count.
   *
   * @param params.dateFrom   - Fecha inicio.
   * @param params.dateTo     - Fecha fin.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Array de keywords canibalizadas con campañas involucradas.
   */
  async getKeywordCannibalization(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const conditions: string[] = ['ks.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;

    if (params.accountId) {
      conditions.push(`c.customer_account_id = $${paramIdx}`);
      values.push(params.accountId);
      paramIdx++;
    }
    paramIdx = this.addAccountIdsFilter(conditions, values, paramIdx, params.accountIds);
    if (params.countryId) {
      conditions.push(`c.country_id = $${paramIdx}`);
      values.push(params.countryId);
      paramIdx++;
    }

    const sql = `
      SELECT
        ks.keyword_text,
        COUNT(DISTINCT c.id) AS campaigns_count,
        STRING_AGG(DISTINCT c.name, ', ') AS campaign_names,
        SUM(ks.clicks) AS total_clicks,
        SUM(ks.impressions) AS total_impressions,
        SUM(ks.cost) AS total_cost,
        SUM(ks.conversions) AS total_conversions
      FROM google_ads_keyword_snapshots ks
      JOIN campaigns c ON c.id = ks.campaign_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY ks.keyword_text
      HAVING COUNT(DISTINCT c.id) > 1
      ORDER BY SUM(ks.cost) DESC
      LIMIT 50
    `;

    const result = await query(sql, values);
    return result.rows;
  }

  // ========== Ad Performance Comparison ==========

  /**
   * Rendimiento por anuncio individual.
   *
   * Tabla: google_ads_ad_snapshots JOIN campaigns
   * Datos por anuncio: headlines, descriptions, final_url, ad_type, status.
   * Métricas: total_clicks, total_impressions, total_cost, total_conversions,
   * CTR, CPC, CPA.
   * Usa EnumMappingService.getAdTypeCaseSQL() para traducir ad_type.
   * Ordenado por ad_group_name y cost DESC.
   *
   * @param params.dateFrom   - Fecha inicio.
   * @param params.dateTo     - Fecha fin.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Array de anuncios con métricas y datos creativos.
   */
  async getAdPerformanceComparison(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const conditions: string[] = ['ads.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;

    if (params.accountId) {
      conditions.push(`c.customer_account_id = $${paramIdx}`);
      values.push(params.accountId);
      paramIdx++;
    }
    paramIdx = this.addAccountIdsFilter(conditions, values, paramIdx, params.accountIds);
    if (params.countryId) {
      conditions.push(`c.country_id = $${paramIdx}`);
      values.push(params.countryId);
      paramIdx++;
    }

    const sql = `
      SELECT
        ads.ad_group_id,
        ads.ad_group_name,
        ads.ad_id,
        ${EnumMappingService.getAdTypeCaseSQL('ads.ad_type')} AS ad_type,
        ads.headlines,
        ads.descriptions,
        ads.final_url,
        ads.status,
        SUM(ads.clicks) AS total_clicks,
        SUM(ads.impressions) AS total_impressions,
        SUM(ads.cost) AS total_cost,
        SUM(ads.conversions) AS total_conversions,
        CASE WHEN SUM(ads.impressions) > 0
          THEN ROUND((SUM(ads.clicks)::numeric / SUM(ads.impressions)::numeric) * 100, 2)
          ELSE 0 END AS ctr,
        CASE WHEN SUM(ads.clicks) > 0
          THEN ROUND((SUM(ads.cost) / SUM(ads.clicks))::numeric, 4)
          ELSE 0 END AS cpc,
        CASE WHEN SUM(ads.conversions) > 0
          THEN ROUND((SUM(ads.cost) / SUM(ads.conversions))::numeric, 2)
          ELSE 0 END AS cpa,
        c.name AS campaign_name,
        c.customer_account_name
      FROM google_ads_ad_snapshots ads
      JOIN campaigns c ON c.id = ads.campaign_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY ads.ad_group_id, ads.ad_group_name, ads.ad_id, ads.ad_type,
               ads.headlines, ads.descriptions, ads.final_url, ads.status, c.name, c.customer_account_name
      ORDER BY ads.ad_group_name, SUM(ads.cost) DESC
    `;

    const result = await query(sql, values);
    return result.rows;
  }

  // ========== Ad Fatigue Detection ==========

  /**
   * Detección de fatiga de anuncios.
   *
   * Calcula CTR diario por anuncio, luego aplica regresión lineal sobre la serie
   * temporal de CTR para detectar tendencia decreciente.
   *
   * Clasificación del slope:
   * - slope < -0.05: fatiga ALTA (CTR cayendo rápidamente)
   * - slope < -0.01: fatiga MODERADA
   * - slope < 0:     fatiga LEVE
   * - slope >= 0:    sin fatiga
   *
   * CTE daily_ctr: CTR por ad_id × snapshot_date.
   * CTE ad_regression: cálculo OLS de slope del CTR.
   *
   * Tabla: google_ads_ad_snapshots JOIN campaigns
   *
   * @param params.dateFrom   - Fecha inicio.
   * @param params.dateTo     - Fecha fin.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Array de anuncios con ctr_slope y fatigue_level.
   */
  async getAdFatigueDetection(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const conditions: string[] = ['ads.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;

    if (params.accountId) {
      conditions.push(`c.customer_account_id = $${paramIdx}`);
      values.push(params.accountId);
      paramIdx++;
    }
    paramIdx = this.addAccountIdsFilter(conditions, values, paramIdx, params.accountIds);
    if (params.countryId) {
      conditions.push(`c.country_id = $${paramIdx}`);
      values.push(params.countryId);
      paramIdx++;
    }

    // Get daily CTR per ad, then compute linear regression to detect declining CTR
    const sql = `
      WITH daily_ctr AS (
        SELECT
          ads.ad_id,
          ads.ad_group_name,
          ads.headlines,
          ads.status,
          ads.snapshot_date,
          c.name AS campaign_name,
          CASE WHEN ads.impressions > 0
            THEN ROUND((ads.clicks::numeric / ads.impressions::numeric) * 100, 4)
            ELSE 0 END AS daily_ctr,
          ads.clicks,
          ads.impressions,
          ads.cost
        FROM google_ads_ad_snapshots ads
        JOIN campaigns c ON c.id = ads.campaign_id
        WHERE ${conditions.join(' AND ')}
      ),
      ad_stats AS (
        SELECT
          ad_id,
          ad_group_name,
          headlines,
          status,
          campaign_name,
          COUNT(*) AS data_points,
          ROUND(AVG(daily_ctr)::numeric, 4) AS avg_ctr,
          SUM(clicks) AS total_clicks,
          SUM(impressions) AS total_impressions,
          SUM(cost) AS total_cost,
          MIN(daily_ctr) AS min_ctr,
          MAX(daily_ctr) AS max_ctr,
          -- Linear regression slope for CTR over time
          CASE WHEN COUNT(*) >= 3 AND
            (COUNT(*) * SUM(EXTRACT(EPOCH FROM snapshot_date) * EXTRACT(EPOCH FROM snapshot_date)) -
             SUM(EXTRACT(EPOCH FROM snapshot_date)) * SUM(EXTRACT(EPOCH FROM snapshot_date))) != 0
          THEN
            ROUND((
              (COUNT(*) * SUM(EXTRACT(EPOCH FROM snapshot_date) * daily_ctr) -
               SUM(EXTRACT(EPOCH FROM snapshot_date)) * SUM(daily_ctr)) /
              (COUNT(*) * SUM(EXTRACT(EPOCH FROM snapshot_date) * EXTRACT(EPOCH FROM snapshot_date)) -
               SUM(EXTRACT(EPOCH FROM snapshot_date)) * SUM(EXTRACT(EPOCH FROM snapshot_date)))
            )::numeric * 86400, 6)
          ELSE 0 END AS ctr_slope_per_day
        FROM daily_ctr
        GROUP BY ad_id, ad_group_name, headlines, status, campaign_name
        HAVING COUNT(*) >= 3
      )
      SELECT *,
        CASE
          WHEN ctr_slope_per_day < -0.05 THEN 'high_fatigue'
          WHEN ctr_slope_per_day < -0.01 THEN 'moderate_fatigue'
          WHEN ctr_slope_per_day < 0 THEN 'slight_decline'
          ELSE 'stable'
        END AS fatigue_level
      FROM ad_stats
      WHERE ctr_slope_per_day < 0
      ORDER BY ctr_slope_per_day ASC
      LIMIT 50
    `;

    const result = await query(sql, values);
    return result.rows;
  }

  // ========== Ad Type Performance ==========

  /**
   * Rendimiento por tipo de anuncio (Responsive Search Ad, Expanded Text Ad, etc.).
   *
   * Tabla: google_ads_ad_snapshots JOIN campaigns
   * Usa EnumMappingService.getAdTypeCaseSQL() para traducir ad_type.
   * Métricas: ad_count, total_clicks, total_impressions, total_cost,
   * total_conversions, CTR, CPC, CPA.
   * Ordenado por total_cost DESC.
   *
   * @param params.dateFrom   - Fecha inicio.
   * @param params.dateTo     - Fecha fin.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Array de tipos de anuncio con métricas agregadas.
   */
  async getAdTypePerformance(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const conditions: string[] = ['ads.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;

    if (params.accountId) {
      conditions.push(`c.customer_account_id = $${paramIdx}`);
      values.push(params.accountId);
      paramIdx++;
    }
    paramIdx = this.addAccountIdsFilter(conditions, values, paramIdx, params.accountIds);
    if (params.countryId) {
      conditions.push(`c.country_id = $${paramIdx}`);
      values.push(params.countryId);
      paramIdx++;
    }

    const sql = `
      SELECT
        ${EnumMappingService.getAdTypeCaseSQL('ads.ad_type')} AS ad_type,
        COUNT(DISTINCT ads.ad_id) AS ad_count,
        SUM(ads.clicks) AS total_clicks,
        SUM(ads.impressions) AS total_impressions,
        SUM(ads.cost) AS total_cost,
        SUM(ads.conversions) AS total_conversions,
        CASE WHEN SUM(ads.impressions) > 0
          THEN ROUND((SUM(ads.clicks)::numeric / SUM(ads.impressions)::numeric) * 100, 2)
          ELSE 0 END AS ctr,
        CASE WHEN SUM(ads.clicks) > 0
          THEN ROUND((SUM(ads.cost) / SUM(ads.clicks))::numeric, 4)
          ELSE 0 END AS cpc,
        CASE WHEN SUM(ads.conversions) > 0
          THEN ROUND((SUM(ads.cost) / SUM(ads.conversions))::numeric, 2)
          ELSE 0 END AS cpa
      FROM google_ads_ad_snapshots ads
      JOIN campaigns c ON c.id = ads.campaign_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY ads.ad_type
      ORDER BY SUM(ads.cost) DESC
    `;

    const result = await query(sql, values);
    return result.rows;
  }

  // ========== Phase 6: Competitive Intelligence / Auction Insights ==========

  /**
   * Resumen de subastas (Auction Insights) por competidor.
   *
   * Tabla: google_ads_auction_insights JOIN campaigns
   * Métricas por display_domain (competidor):
   * - avg_overlap_rate: qué tan frecuente aparece el competidor cuando tú apareces
   * - avg_position_above_rate: qué tan frecuente el competidor sale arriba
   * - avg_outranking_share: proporción en que superas al competidor
   * - avg_impression_share: IS promedio del competidor
   * - data_points: cantidad de registros
   *
   * Top 30 competidores por overlap_rate DESC.
   *
   * @param params.dateFrom   - Fecha inicio.
   * @param params.dateTo     - Fecha fin.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Array de competidores con métricas de subasta.
   */
  async getAuctionInsightsSummary(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const conditions: string[] = ['ai.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;

    if (params.accountId) {
      conditions.push(`c.customer_account_id = $${paramIdx}`);
      values.push(params.accountId);
      paramIdx++;
    }
    paramIdx = this.addAccountIdsFilter(conditions, values, paramIdx, params.accountIds);
    if (params.countryId) {
      conditions.push(`c.country_id = $${paramIdx}`);
      values.push(params.countryId);
      paramIdx++;
    }

    const sql = `
      SELECT
        ai.display_domain,
        ROUND(AVG(ai.overlap_rate)::numeric, 4) AS avg_overlap_rate,
        ROUND(AVG(ai.position_above_rate)::numeric, 4) AS avg_position_above_rate,
        ROUND(AVG(ai.outranking_share)::numeric, 4) AS avg_outranking_share,
        ROUND(AVG(ai.impression_share)::numeric, 4) AS avg_impression_share,
        COUNT(*) AS data_points
      FROM google_ads_auction_insights ai
      JOIN campaigns c ON c.id = ai.campaign_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY ai.display_domain
      ORDER BY AVG(ai.overlap_rate) DESC
      LIMIT 30
    `;

    const result = await query(sql, values);
    return result.rows;
  }

  /**
   * Posición competitiva diaria.
   *
   * Tendencia diaria de métricas competitivas:
   * - IS propia (impression_share)
   * - overlap_rate de competidores
   * - position_above_rate: frecuencia con la que aparecen arriba
   * - outranking_share: proporción en que superas a competidores
   *
   * Tabla: google_ads_auction_insights JOIN campaigns
   * Agrupado por snapshot_date.
   *
   * @param params.dateFrom   - Fecha inicio.
   * @param params.dateTo     - Fecha fin.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Array de filas diarias con métricas competitivas.
   */
  async getCompetitivePosition(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const conditions: string[] = ['ai.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;

    if (params.accountId) {
      conditions.push(`c.customer_account_id = $${paramIdx}`);
      values.push(params.accountId);
      paramIdx++;
    }
    paramIdx = this.addAccountIdsFilter(conditions, values, paramIdx, params.accountIds);
    if (params.countryId) {
      conditions.push(`c.country_id = $${paramIdx}`);
      values.push(params.countryId);
      paramIdx++;
    }

    const sql = `
      SELECT
        ai.snapshot_date,
        ROUND(AVG(ai.impression_share)::numeric, 4) AS your_impression_share,
        ROUND(AVG(ai.overlap_rate)::numeric, 4) AS avg_competitor_overlap,
        ROUND(AVG(ai.position_above_rate)::numeric, 4) AS avg_position_above,
        ROUND(AVG(ai.outranking_share)::numeric, 4) AS avg_outranking,
        COUNT(DISTINCT ai.display_domain) AS competitor_count
      FROM google_ads_auction_insights ai
      JOIN campaigns c ON c.id = ai.campaign_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY ai.snapshot_date
      ORDER BY ai.snapshot_date ASC
    `;

    const result = await query(sql, values);
    return result.rows;
  }

  /**
   * Oportunidades de mercado.
   *
   * Identifica campañas con Impression Share < 50% pero que generan conversiones > 0.
   * Estas son oportunidades donde más presupuesto podría generar más conversiones.
   *
   * opportunity_pct = (1 - avg_impression_share) × 100
   *
   * CTEs: campaign_insights (IS por campaña), campaign_perf (métricas de rendimiento).
   * Tablas: google_ads_auction_insights, google_ads_snapshots, campaigns
   * Top 30 por conversiones DESC.
   *
   * @param params.dateFrom   - Fecha inicio.
   * @param params.dateTo     - Fecha fin.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Array de campañas con opportunity_pct, avg_impression_share y métricas.
   */
  async getMarketOpportunities(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const conditions: string[] = ['ai.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'", 'gs.snapshot_date BETWEEN $1 AND $2'];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;

    if (params.accountId) {
      conditions.push(`c.customer_account_id = $${paramIdx}`);
      values.push(params.accountId);
      paramIdx++;
    }
    paramIdx = this.addAccountIdsFilter(conditions, values, paramIdx, params.accountIds);
    if (params.countryId) {
      conditions.push(`c.country_id = $${paramIdx}`);
      values.push(params.countryId);
      paramIdx++;
    }

    const sql = `
      WITH campaign_insights AS (
        SELECT
          ai.campaign_id,
          ROUND(AVG(ai.impression_share)::numeric, 4) AS avg_impression_share,
          ROUND(AVG(ai.outranking_share)::numeric, 4) AS avg_outranking_share,
          COUNT(DISTINCT ai.display_domain) AS competitor_count
        FROM google_ads_auction_insights ai
        JOIN campaigns c ON c.id = ai.campaign_id
        WHERE ${conditions.filter(c => !c.startsWith('gs.')).join(' AND ')}
        GROUP BY ai.campaign_id
      ),
      campaign_perf AS (
        SELECT
          gs.campaign_id,
          SUM(gs.conversions) AS total_conversions,
          SUM(gs.cost) AS total_cost,
          SUM(gs.clicks) AS total_clicks,
          SUM(gs.impressions) AS total_impressions
        FROM google_ads_snapshots gs
        JOIN campaigns c ON c.id = gs.campaign_id
        WHERE gs.snapshot_date BETWEEN $1 AND $2
          ${params.accountId ? `AND c.customer_account_id = $${conditions.indexOf(`c.customer_account_id = $${3}`) >= 0 ? 3 : paramIdx}` : ''}
          ${params.countryId ? `AND c.country_id = $${params.accountId ? 4 : 3}` : ''}
        GROUP BY gs.campaign_id
      )
      SELECT
        c.name AS campaign_name,
        c.customer_account_name,
        ci.avg_impression_share,
        ci.avg_outranking_share,
        ci.competitor_count,
        cp.total_conversions,
        cp.total_cost,
        cp.total_clicks,
        cp.total_impressions,
        CASE WHEN cp.total_conversions > 0
          THEN ROUND((cp.total_cost / cp.total_conversions)::numeric, 2)
          ELSE 0 END AS cpa,
        CASE WHEN cp.total_impressions > 0
          THEN ROUND((cp.total_clicks::numeric / cp.total_impressions::numeric) * 100, 2)
          ELSE 0 END AS ctr,
        ROUND((1 - ci.avg_impression_share) * 100, 2) AS opportunity_pct
      FROM campaign_insights ci
      JOIN campaign_perf cp ON cp.campaign_id = ci.campaign_id
      JOIN campaigns c ON c.id = ci.campaign_id
      WHERE ci.avg_impression_share < 0.5
        AND cp.total_conversions > 0
      ORDER BY cp.total_conversions DESC, ci.avg_impression_share ASC
      LIMIT 30
    `;

    const result = await query(sql, values);
    return result.rows;
  }

  // ========== Phase 7: Demographics ==========

  /**
   * Rendimiento por rango de edad.
   *
   * Tabla: google_ads_demographics_snapshots (filtro demographic_type = 'AGE')
   * JOIN campaigns
   * Métricas: total_clicks, total_impressions, total_cost, total_conversions,
   * CTR, CPC, CPA.
   * Agrupado por demographic_value (ej: '18-24', '25-34', etc.).
   *
   * @param params.dateFrom   - Fecha inicio.
   * @param params.dateTo     - Fecha fin.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Array de rangos de edad con métricas, ordenados por cost DESC.
   */
  async getAgeBreakdown(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const conditions: string[] = ['ds.snapshot_date BETWEEN $1 AND $2', "ds.demographic_type = 'AGE'", "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;

    if (params.accountId) {
      conditions.push(`c.customer_account_id = $${paramIdx}`);
      values.push(params.accountId);
      paramIdx++;
    }
    paramIdx = this.addAccountIdsFilter(conditions, values, paramIdx, params.accountIds);
    if (params.countryId) {
      conditions.push(`c.country_id = $${paramIdx}`);
      values.push(params.countryId);
      paramIdx++;
    }

    const sql = `
      SELECT
        ${EnumMappingService.getAgeCaseSQL('ds.demographic_value')} AS demographic_value,
        SUM(ds.clicks) AS total_clicks,
        SUM(ds.impressions) AS total_impressions,
        SUM(ds.cost) AS total_cost,
        SUM(ds.conversions) AS total_conversions,
        CASE WHEN SUM(ds.impressions) > 0
          THEN ROUND((SUM(ds.clicks)::numeric / SUM(ds.impressions)::numeric) * 100, 2)
          ELSE 0 END AS ctr,
        CASE WHEN SUM(ds.clicks) > 0
          THEN ROUND((SUM(ds.cost) / SUM(ds.clicks))::numeric, 2)
          ELSE 0 END AS cpc,
        CASE WHEN SUM(ds.conversions) > 0
          THEN ROUND((SUM(ds.cost) / SUM(ds.conversions))::numeric, 2)
          ELSE 0 END AS cpa
      FROM google_ads_demographics_snapshots ds
      JOIN campaigns c ON c.id = ds.campaign_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY ds.demographic_value
      ORDER BY SUM(ds.cost) DESC
    `;

    const result = await query(sql, values);
    return result.rows;
  }

  /**
   * Rendimiento por género.
   *
   * Tabla: google_ads_demographics_snapshots (filtro demographic_type = 'GENDER')
   * JOIN campaigns
   * Usa EnumMappingService.getGenderCaseSQL() para traducir el valor numérico.
   * Métricas: total_clicks, total_impressions, total_cost, total_conversions,
   * CTR, CPC, CPA.
   * Agrupado por demographic_value (Male, Female, Undetermined).
   *
   * @param params.dateFrom   - Fecha inicio.
   * @param params.dateTo     - Fecha fin.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Array de géneros con métricas, ordenados por cost DESC.
   */
  async getGenderBreakdown(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const conditions: string[] = ['ds.snapshot_date BETWEEN $1 AND $2', "ds.demographic_type = 'GENDER'", "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;

    if (params.accountId) {
      conditions.push(`c.customer_account_id = $${paramIdx}`);
      values.push(params.accountId);
      paramIdx++;
    }
    paramIdx = this.addAccountIdsFilter(conditions, values, paramIdx, params.accountIds);
    if (params.countryId) {
      conditions.push(`c.country_id = $${paramIdx}`);
      values.push(params.countryId);
      paramIdx++;
    }

    const sql = `
      SELECT
        ${EnumMappingService.getGenderCaseSQL('ds.demographic_value')} AS demographic_value,
        SUM(ds.clicks) AS total_clicks,
        SUM(ds.impressions) AS total_impressions,
        SUM(ds.cost) AS total_cost,
        SUM(ds.conversions) AS total_conversions,
        CASE WHEN SUM(ds.impressions) > 0
          THEN ROUND((SUM(ds.clicks)::numeric / SUM(ds.impressions)::numeric) * 100, 2)
          ELSE 0 END AS ctr,
        CASE WHEN SUM(ds.clicks) > 0
          THEN ROUND((SUM(ds.cost) / SUM(ds.clicks))::numeric, 2)
          ELSE 0 END AS cpc,
        CASE WHEN SUM(ds.conversions) > 0
          THEN ROUND((SUM(ds.cost) / SUM(ds.conversions))::numeric, 2)
          ELSE 0 END AS cpa
      FROM google_ads_demographics_snapshots ds
      JOIN campaigns c ON c.id = ds.campaign_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY ds.demographic_value
      ORDER BY SUM(ds.cost) DESC
    `;

    const result = await query(sql, values);
    return result.rows;
  }

  // ============ Phase 9: Enhanced Tabs ============

  /**
   * Recomendaciones de ajuste de puja por dispositivo.
   *
   * Compara el CPA de cada dispositivo con el CPA promedio de la campaña.
   * - Si CPA dispositivo > 130% del promedio → ajuste negativo (reducir puja).
   * - Si CPA dispositivo < 70% del promedio → ajuste positivo (aumentar puja).
   * - Si 0 conversiones en dispositivo → excluir (ajuste = -100%).
   *
   * CTEs: device_perf (métricas por campaña×dispositivo), campaign_avg (CPA promedio).
   * Tabla: google_ads_device_snapshots JOIN campaigns
   * Calcula estimated_savings por ajuste.
   *
   * @param params.dateFrom   - Fecha inicio.
   * @param params.dateTo     - Fecha fin.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Array de dispositivos con bid_adjustment y estimated_savings.
   */
  async getDeviceBidRecommendations(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const conditions: string[] = ['ds.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;
    if (params.accountId) { conditions.push(`c.customer_account_id = $${paramIdx}`); values.push(params.accountId); paramIdx++; }
    if (params.countryId) { conditions.push(`c.country_id = $${paramIdx}`); values.push(params.countryId); paramIdx++; }

    const sql = `
      WITH device_perf AS (
        SELECT
          c.name AS campaign_name,
          c.customer_account_id,
          c.customer_account_name,
          ${EnumMappingService.getDeviceCaseSQL('ds.device')} AS device,
          SUM(ds.cost) AS device_cost,
          SUM(ds.clicks) AS device_clicks,
          SUM(ds.conversions) AS device_conversions,
          CASE WHEN SUM(ds.conversions) > 0
            THEN ROUND((SUM(ds.cost) / SUM(ds.conversions))::numeric, 2)
            ELSE NULL END AS device_cpa
        FROM google_ads_device_snapshots ds
        JOIN campaigns c ON c.id = ds.campaign_id
        WHERE ${conditions.join(' AND ')}
        GROUP BY c.name, c.customer_account_id, c.customer_account_name, ds.device
        HAVING SUM(ds.cost) > 0
      ),
      campaign_avg AS (
        SELECT
          campaign_name,
          customer_account_id,
          ROUND((SUM(device_cost) / NULLIF(SUM(device_conversions), 0))::numeric, 2) AS avg_cpa
        FROM device_perf
        GROUP BY campaign_name, customer_account_id
      )
      SELECT
        dp.campaign_name,
        dp.customer_account_id,
        dp.customer_account_name,
        dp.device,
        dp.device_cost,
        dp.device_clicks,
        dp.device_conversions,
        dp.device_cpa AS current_cpa,
        ca.avg_cpa,
        CASE
          WHEN ca.avg_cpa IS NULL OR ca.avg_cpa = 0 THEN 0
          WHEN dp.device_cpa IS NULL THEN -100
          WHEN dp.device_cpa > ca.avg_cpa * 1.3 THEN -ROUND(((dp.device_cpa - ca.avg_cpa) / dp.device_cpa * 100)::numeric, 0)
          WHEN dp.device_cpa < ca.avg_cpa * 0.7 THEN ROUND(((ca.avg_cpa - dp.device_cpa) / ca.avg_cpa * 100)::numeric, 0)
          ELSE 0
        END AS recommended_adjustment_pct,
        CASE
          WHEN dp.device_cpa IS NULL THEN dp.device_cost
          WHEN ca.avg_cpa IS NOT NULL AND dp.device_cpa > ca.avg_cpa * 1.3
            THEN ROUND((dp.device_cost - (dp.device_conversions * ca.avg_cpa))::numeric, 2)
          ELSE 0
        END AS estimated_savings
      FROM device_perf dp
      JOIN campaign_avg ca ON ca.campaign_name = dp.campaign_name AND ca.customer_account_id = dp.customer_account_id
      WHERE dp.device_cpa IS NULL OR ca.avg_cpa IS NULL OR dp.device_cpa > ca.avg_cpa * 1.3 OR dp.device_cpa < ca.avg_cpa * 0.7
      ORDER BY estimated_savings DESC
    `;
    const result = await query(sql, values);
    return result.rows;
  }

  /**
   * Dispositivos candidatos a exclusión.
   *
   * Identifica combinaciones cuenta×dispositivo con gasto > 0 y 0 conversiones.
   * Estos dispositivos están consumiendo presupuesto sin generar resultados
   * y son candidatos a ser excluidos.
   *
   * Tabla: google_ads_device_snapshots JOIN campaigns
   * HAVING: SUM(cost) > 0 AND SUM(conversions) = 0
   *
   * @param params.dateFrom   - Fecha inicio.
   * @param params.dateTo     - Fecha fin.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Array de {customer_account_id, device, campaigns_affected, total_cost}.
   */
  async getDeviceExclusions(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const conditions: string[] = ['ds.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;
    if (params.accountId) { conditions.push(`c.customer_account_id = $${paramIdx}`); values.push(params.accountId); paramIdx++; }
    if (params.countryId) { conditions.push(`c.country_id = $${paramIdx}`); values.push(params.countryId); paramIdx++; }

    const sql = `
      SELECT
        c.customer_account_id,
        c.customer_account_name,
        ${EnumMappingService.getDeviceCaseSQL('ds.device')} AS device,
        COUNT(DISTINCT c.id) AS campaigns_affected,
        SUM(ds.cost) AS total_cost,
        SUM(ds.clicks) AS total_clicks,
        SUM(ds.conversions) AS total_conversions
      FROM google_ads_device_snapshots ds
      JOIN campaigns c ON c.id = ds.campaign_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY c.customer_account_id, c.customer_account_name, ds.device
      HAVING SUM(ds.cost) > 0 AND SUM(ds.conversions) = 0
      ORDER BY SUM(ds.cost) DESC
    `;
    const result = await query(sql, values);
    return result.rows;
  }

  /**
   * Clasificación geográfica en tiers.
   *
   * Clasifica ubicaciones geográficas según su CPA relativo al promedio global:
   * - TIER_1: CPA <= promedio (eficientes, priorizar)
   * - TIER_2: CPA <= 1.3× promedio (aceptables)
   * - TIER_3: CPA > 1.3× promedio o sin conversiones (candidatos a reducir/excluir)
   *
   * CTEs: geo_metrics (métricas por ubicación), global_avg (CPA promedio).
   * Tabla: google_ads_geo_snapshots JOIN campaigns
   * Calcula estimated_savings para TIER_3.
   *
   * @param params.dateFrom   - Fecha inicio.
   * @param params.dateTo     - Fecha fin.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Array de ubicaciones con tier y estimated_savings.
   */
  async getGeoTierClassification(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const conditions: string[] = ['gs.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;
    if (params.accountId) { conditions.push(`c.customer_account_id = $${paramIdx}`); values.push(params.accountId); paramIdx++; }
    if (params.countryId) { conditions.push(`c.country_id = $${paramIdx}`); values.push(params.countryId); paramIdx++; }

    const geoNameTier = this.geoNameSql('gs.geo_target_name', 'geo_target_name');
    const sql = `
      WITH geo_metrics AS (
        SELECT
          ${geoNameTier},
          gs.geo_target_type,
          SUM(gs.cost) AS total_cost,
          SUM(gs.clicks) AS total_clicks,
          SUM(gs.conversions) AS total_conversions,
          CASE WHEN SUM(gs.conversions) > 0
            THEN ROUND((SUM(gs.cost) / SUM(gs.conversions))::numeric, 2)
            ELSE NULL END AS cpa
        FROM google_ads_geo_snapshots gs
        JOIN campaigns c ON c.id = gs.campaign_id
        WHERE ${conditions.join(' AND ')}
        GROUP BY gs.geo_target_name, gs.geo_target_type
        HAVING SUM(gs.cost) > 0
      ),
      global_avg AS (
        SELECT ROUND(AVG(cpa)::numeric, 2) AS avg_cpa FROM geo_metrics WHERE cpa IS NOT NULL
      )
      SELECT
        gm.geo_target_name,
        gm.geo_target_type,
        gm.total_cost,
        gm.total_clicks,
        gm.total_conversions,
        gm.cpa,
        ga.avg_cpa,
        CASE
          WHEN gm.total_conversions = 0 THEN 'TIER_3'
          WHEN gm.cpa <= ga.avg_cpa THEN 'TIER_1'
          WHEN gm.cpa <= ga.avg_cpa * 1.3 THEN 'TIER_2'
          ELSE 'TIER_3'
        END AS tier,
        CASE
          WHEN gm.total_conversions = 0 THEN gm.total_cost
          WHEN gm.cpa > ga.avg_cpa * 1.3 THEN ROUND((gm.total_cost - (gm.total_conversions * ga.avg_cpa))::numeric, 2)
          ELSE 0
        END AS estimated_savings
      FROM geo_metrics gm
      CROSS JOIN global_avg ga
      ORDER BY
        CASE WHEN gm.total_conversions = 0 THEN 'TIER_3' WHEN gm.cpa <= ga.avg_cpa THEN 'TIER_1' WHEN gm.cpa <= ga.avg_cpa * 1.3 THEN 'TIER_2' ELSE 'TIER_3' END,
        gm.total_cost DESC
    `;
    const result = await query(sql, values);
    return result.rows;
  }

  /**
   * Patrones regionales por tipo de geo (Country, Region, City, etc.).
   *
   * Agrupa métricas por geo_target_type para entender el rendimiento
   * a diferentes niveles geográficos.
   * Métricas: locations_count, total_cost, total_clicks, total_impressions,
   * total_conversions, CPC, CTR, CPA.
   *
   * Tabla: google_ads_geo_snapshots JOIN campaigns
   *
   * @param params.dateFrom   - Fecha inicio.
   * @param params.dateTo     - Fecha fin.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Array de {geo_type, locations_count, total_cost, cpc, ctr, cpa}.
   */
  async getRegionalPatterns(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const conditions: string[] = ['gs.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;
    if (params.accountId) { conditions.push(`c.customer_account_id = $${paramIdx}`); values.push(params.accountId); paramIdx++; }
    if (params.countryId) { conditions.push(`c.country_id = $${paramIdx}`); values.push(params.countryId); paramIdx++; }

    const sql = `
      SELECT
        COALESCE(gs.geo_target_type, 'Desconocido') AS geo_type,
        COUNT(DISTINCT gs.geo_target_name) AS locations_count,
        SUM(gs.cost) AS total_cost,
        SUM(gs.clicks) AS total_clicks,
        SUM(gs.impressions) AS total_impressions,
        SUM(gs.conversions) AS total_conversions,
        CASE WHEN SUM(gs.clicks) > 0
          THEN ROUND((SUM(gs.cost) / SUM(gs.clicks))::numeric, 2)
          ELSE 0 END AS cpc,
        CASE WHEN SUM(gs.impressions) > 0
          THEN ROUND((SUM(gs.clicks)::numeric / SUM(gs.impressions) * 100)::numeric, 2)
          ELSE 0 END AS ctr,
        CASE WHEN SUM(gs.conversions) > 0
          THEN ROUND((SUM(gs.cost) / SUM(gs.conversions))::numeric, 2)
          ELSE 0 END AS cpa
      FROM google_ads_geo_snapshots gs
      JOIN campaigns c ON c.id = gs.campaign_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY COALESCE(gs.geo_target_type, 'Desconocido')
      ORDER BY SUM(gs.cost) DESC
    `;
    const result = await query(sql, values);
    return result.rows;
  }

  /**
   * Plan de acción por keyword.
   *
   * Clasifica cada keyword según reglas de negocio:
   * - PAUSAR: 0 conversiones + gasto > $50 (desperdicio claro)
   * - BAJAR: CPA > 1.5× promedio global (ineficiente)
   * - SUBIR: CPA < 0.7× promedio global + >= 2 conversiones (oportunidad)
   * - MANTENER: resto
   *
   * CTEs: kw_metrics (métricas por keyword×cuenta), global_avg (CPA promedio).
   * Tabla: google_ads_keyword_snapshots JOIN campaigns
   * Calcula estimated_savings por cada acción.
   *
   * @param params.dateFrom   - Fecha inicio.
   * @param params.dateTo     - Fecha fin.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Array de keywords con action (PAUSAR/BAJAR/SUBIR/MANTENER) y estimated_savings.
   */
  async getKeywordActionPlan(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const conditions: string[] = ['ks.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;
    if (params.accountId) { conditions.push(`c.customer_account_id = $${paramIdx}`); values.push(params.accountId); paramIdx++; }
    if (params.countryId) { conditions.push(`c.country_id = $${paramIdx}`); values.push(params.countryId); paramIdx++; }

    const sql = `
      WITH kw_metrics AS (
        SELECT
          ks.keyword_text,
          ${EnumMappingService.getMatchTypeCaseSQL('ks.match_type')} AS match_type,
          c.customer_account_id,
          c.customer_account_name,
          STRING_AGG(DISTINCT c.name, ', ') AS campaign_names,
          SUM(ks.cost) AS total_cost,
          SUM(ks.clicks) AS total_clicks,
          SUM(ks.conversions) AS total_conversions,
          AVG(ks.quality_score) AS avg_qs,
          CASE WHEN SUM(ks.conversions) > 0
            THEN ROUND((SUM(ks.cost) / SUM(ks.conversions))::numeric, 2)
            ELSE NULL END AS cpa
        FROM google_ads_keyword_snapshots ks
        JOIN campaigns c ON c.id = ks.campaign_id
        WHERE ${conditions.join(' AND ')}
        GROUP BY ks.keyword_text, ks.match_type, c.customer_account_id, c.customer_account_name
        HAVING SUM(ks.cost) > 0
      ),
      global_avg AS (
        SELECT ROUND(AVG(cpa)::numeric, 2) AS avg_cpa FROM kw_metrics WHERE cpa IS NOT NULL
      )
      SELECT
        km.keyword_text,
        km.match_type,
        km.customer_account_id,
        km.customer_account_name,
        km.campaign_names,
        km.total_cost,
        km.total_clicks,
        km.total_conversions,
        ROUND(km.avg_qs::numeric, 1) AS avg_qs,
        km.cpa,
        ga.avg_cpa,
        CASE
          WHEN km.total_conversions = 0 AND km.total_cost > 50 THEN 'PAUSAR'
          WHEN km.cpa IS NOT NULL AND km.cpa > ga.avg_cpa * 1.5 THEN 'BAJAR'
          WHEN km.cpa IS NOT NULL AND km.cpa < ga.avg_cpa * 0.7 AND km.total_conversions >= 2 THEN 'SUBIR'
          ELSE 'MANTENER'
        END AS action,
        CASE
          WHEN km.total_conversions = 0 THEN km.total_cost
          WHEN km.cpa IS NOT NULL AND km.cpa > ga.avg_cpa * 1.5
            THEN ROUND((km.total_cost - (km.total_conversions * ga.avg_cpa))::numeric, 2)
          ELSE 0
        END AS potential_savings
      FROM kw_metrics km
      CROSS JOIN global_avg ga
      ORDER BY
        CASE
          WHEN km.total_conversions = 0 AND km.total_cost > 50 THEN 1
          WHEN km.cpa IS NOT NULL AND km.cpa > ga.avg_cpa * 1.5 THEN 2
          WHEN km.cpa IS NOT NULL AND km.cpa < ga.avg_cpa * 0.7 AND km.total_conversions >= 2 THEN 3
          ELSE 4
        END,
        km.total_cost DESC
    `;
    const result = await query(sql, values);
    return result.rows;
  }

  /**
   * Recomendaciones de tipo de concordancia (match type).
   *
   * Reglas de recomendación:
   * - Broad sin conversiones o CPA alto (>1.5× avg) → cambiar a Exact
   * - Exact con buen CTR (> avg) pero pocas impresiones (<100) → cambiar a Phrase
   * - Broad con CTR < 50% del promedio → cambiar a Phrase
   *
   * Cada recomendación incluye una razón en español.
   * Solo retorna keywords que necesitan cambio (WHERE filtra las que no).
   *
   * CTEs: kw_metrics (métricas por keyword), global_avg (CPA y CTR promedios).
   * Tabla: google_ads_keyword_snapshots JOIN campaigns
   *
   * @param params.dateFrom   - Fecha inicio.
   * @param params.dateTo     - Fecha fin.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Array de keywords con suggested_match_type y reason.
   */
  async getMatchTypeRecommendations(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const conditions: string[] = ['ks.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;
    if (params.accountId) { conditions.push(`c.customer_account_id = $${paramIdx}`); values.push(params.accountId); paramIdx++; }
    if (params.countryId) { conditions.push(`c.country_id = $${paramIdx}`); values.push(params.countryId); paramIdx++; }

    const sql = `
      WITH kw_metrics AS (
        SELECT
          ks.keyword_text,
          ${EnumMappingService.getMatchTypeCaseSQL('ks.match_type')} AS match_type,
          c.customer_account_id,
          c.customer_account_name,
          c.name AS campaign_name,
          SUM(ks.cost) AS total_cost,
          SUM(ks.clicks) AS total_clicks,
          SUM(ks.impressions) AS total_impressions,
          SUM(ks.conversions) AS total_conversions,
          CASE WHEN SUM(ks.conversions) > 0
            THEN ROUND((SUM(ks.cost) / SUM(ks.conversions))::numeric, 2)
            ELSE NULL END AS cpa,
          CASE WHEN SUM(ks.impressions) > 0
            THEN ROUND((SUM(ks.clicks)::numeric / SUM(ks.impressions) * 100)::numeric, 2)
            ELSE 0 END AS ctr
        FROM google_ads_keyword_snapshots ks
        JOIN campaigns c ON c.id = ks.campaign_id
        WHERE ${conditions.join(' AND ')}
        GROUP BY ks.keyword_text, ks.match_type, c.customer_account_id, c.customer_account_name, c.name
        HAVING SUM(ks.cost) > 0
      ),
      global_avg AS (
        SELECT
          ROUND(AVG(cpa)::numeric, 2) AS avg_cpa,
          ROUND(AVG(ctr)::numeric, 2) AS avg_ctr
        FROM kw_metrics WHERE cpa IS NOT NULL
      )
      SELECT
        km.keyword_text,
        km.match_type,
        km.customer_account_id,
        km.customer_account_name,
        km.campaign_name,
        km.total_cost,
        km.total_clicks,
        km.total_impressions,
        km.total_conversions,
        km.cpa,
        km.ctr,
        CASE
          WHEN km.match_type = 'Broad' AND (km.total_conversions = 0 OR km.cpa > ga.avg_cpa * 1.5) THEN 'Exact'
          WHEN km.match_type = 'Exact' AND km.ctr > ga.avg_ctr AND km.total_impressions < 100 THEN 'Phrase'
          WHEN km.match_type = 'Broad' AND km.ctr < ga.avg_ctr * 0.5 THEN 'Phrase'
          ELSE NULL
        END AS suggested_match_type,
        CASE
          WHEN km.match_type = 'Broad' AND (km.total_conversions = 0 OR km.cpa > ga.avg_cpa * 1.5) THEN 'Alto costo sin retorno en concordancia amplia'
          WHEN km.match_type = 'Exact' AND km.ctr > ga.avg_ctr AND km.total_impressions < 100 THEN 'Buen CTR pero pocas impresiones, ampliar concordancia'
          WHEN km.match_type = 'Broad' AND km.ctr < ga.avg_ctr * 0.5 THEN 'CTR bajo en amplia, restringir concordancia'
          ELSE NULL
        END AS reason
      FROM kw_metrics km
      CROSS JOIN global_avg ga
      WHERE
        (km.match_type = 'Broad' AND (km.total_conversions = 0 OR km.cpa > ga.avg_cpa * 1.5))
        OR (km.match_type = 'Exact' AND km.ctr > ga.avg_ctr AND km.total_impressions < 100)
        OR (km.match_type = 'Broad' AND km.ctr < ga.avg_ctr * 0.5)
      ORDER BY km.total_cost DESC
    `;
    const result = await query(sql, values);
    return result.rows;
  }

  /**
   * Keywords cross-account.
   *
   * Identifica las top keywords de una cuenta (por conversiones) que NO existen
   * en otras cuentas del mismo país. Esto permite expandir keywords exitosas
   * a cuentas que aún no las utilizan.
   *
   * CTEs: top_keywords (mejores keywords por cuenta), all_accounts (cuentas del mismo país),
   * keyword_presence (dónde existe cada keyword).
   * Tabla: google_ads_keyword_snapshots JOIN campaigns
   * Top 50 por conversiones DESC.
   *
   * @param params.dateFrom   - Fecha inicio.
   * @param params.dateTo     - Fecha fin.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Array de keywords con cuentas donde no existen (missing_in_accounts).
   */
  async getCrossAccountKeywords(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const conditions: string[] = ['ks.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;
    if (params.accountId) { conditions.push(`c.customer_account_id = $${paramIdx}`); values.push(params.accountId); paramIdx++; }
    if (params.countryId) { conditions.push(`c.country_id = $${paramIdx}`); values.push(params.countryId); paramIdx++; }

    const sql = `
      WITH kw_perf AS (
        SELECT
          ks.keyword_text,
          c.customer_account_id,
          c.customer_account_name,
          c.country_id,
          SUM(ks.cost) AS total_cost,
          SUM(ks.conversions) AS total_conversions,
          CASE WHEN SUM(ks.conversions) > 0
            THEN ROUND((SUM(ks.cost) / SUM(ks.conversions))::numeric, 2)
            ELSE NULL END AS cpa,
          CASE WHEN SUM(ks.impressions) > 0
            THEN ROUND((SUM(ks.clicks)::numeric / SUM(ks.impressions) * 100)::numeric, 2)
            ELSE 0 END AS ctr
        FROM google_ads_keyword_snapshots ks
        JOIN campaigns c ON c.id = ks.campaign_id
        WHERE ${conditions.join(' AND ')}
        GROUP BY ks.keyword_text, c.customer_account_id, c.customer_account_name, c.country_id
        HAVING SUM(ks.conversions) > 0
      ),
      ranked AS (
        SELECT *,
          PERCENT_RANK() OVER (PARTITION BY customer_account_id ORDER BY cpa ASC) AS perf_rank
        FROM kw_perf
      ),
      top_kws AS (
        SELECT * FROM ranked WHERE perf_rank >= 0.9
      ),
      all_accounts AS (
        SELECT DISTINCT customer_account_id, country_id FROM kw_perf
      )
      SELECT
        tk.keyword_text,
        tk.customer_account_id AS source_account_id,
        tk.customer_account_name AS source_account_name,
        tk.total_conversions AS source_conversions,
        tk.cpa AS source_cpa,
        tk.ctr AS source_ctr,
        COUNT(DISTINCT aa.customer_account_id) AS potential_accounts
      FROM top_kws tk
      CROSS JOIN all_accounts aa
      WHERE aa.country_id = tk.country_id
        AND aa.customer_account_id != tk.customer_account_id
        AND NOT EXISTS (
          SELECT 1 FROM kw_perf kp
          WHERE kp.keyword_text = tk.keyword_text
            AND kp.customer_account_id = aa.customer_account_id
        )
      GROUP BY tk.keyword_text, tk.customer_account_id, tk.customer_account_name, tk.total_conversions, tk.cpa, tk.ctr
      HAVING COUNT(DISTINCT aa.customer_account_id) > 0
      ORDER BY tk.total_conversions DESC, tk.cpa ASC
      LIMIT 50
    `;
    const result = await query(sql, values);
    return result.rows;
  }

  /**
   * Forecast completo a 90 días con 2 modelos Holt-Winters independientes.
   *
   * Modelo 1: cost (gasto diario) → horizonte 90 días
   * Modelo 2: conversions (conversiones diarias) → horizonte 90 días
   * CPA derivado = cost / conversions (NO se forecasta independientemente).
   *
   * Intervalos de confianza conservadores para CPA:
   *   CPA_lower = cost_lower / conv_upper (mejor caso)
   *   CPA_upper = cost_upper / conv_lower (peor caso)
   *
   * Retorna proyecciones a 30 y 90 días para cost, conversions y CPA.
   * Incluye daily_forecast para gráficos del frontend.
   *
   * Tabla: google_ads_snapshots JOIN campaigns
   * Dependencia: fitHoltWinters() de ml-analytics.service.ts
   * Requiere mínimo 7 datos históricos.
   *
   * @param params.dateFrom   - Fecha inicio (para filtrar vista, no el modelo).
   * @param params.dateTo     - Fecha fin.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Objeto {trend, forecast: {cost_30d, cost_90d, conversions_30d, cpa_30d, ...}}.
   */
  async getFullForecast(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    // Pull ALL history for modeling
    const conditions: string[] = ["c.ads_status = 'ENABLED'"];
    const values: any[] = [];
    let paramIdx = 1;
    if (params.accountId) { conditions.push(`c.customer_account_id = $${paramIdx}`); values.push(params.accountId); paramIdx++; }
    paramIdx = this.addAccountIdsFilter(conditions, values, paramIdx, params.accountIds);
    if (params.countryId) { conditions.push(`c.country_id = $${paramIdx}`); values.push(params.countryId); paramIdx++; }

    const sql = `
      SELECT
        gs.snapshot_date,
        SUM(gs.cost) AS daily_cost,
        SUM(gs.conversions) AS daily_conversions,
        CASE WHEN SUM(gs.conversions) > 0
          THEN ROUND((SUM(gs.cost) / SUM(gs.conversions))::numeric, 2)
          ELSE NULL END AS daily_cpa
      FROM google_ads_snapshots gs
      JOIN campaigns c ON c.id = gs.campaign_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY gs.snapshot_date
      ORDER BY gs.snapshot_date
    `;
    const result = await query(sql, values);
    const allRows = result.rows;

    if (allRows.length < 7) return { trend: allRows, forecast: null };

    const costSeries = allRows.map((r: any) => Number(r.daily_cost) || 0);
    const convSeries = allRows.map((r: any) => Number(r.daily_conversions) || 0);

    // Holt-Winters for cost (90-day horizon)
    const hwCost = fitHoltWinters(costSeries, 7, 90);
    // Holt-Winters for conversions (90-day horizon)
    const hwConv = fitHoltWinters(convSeries, 7, 90);

    // CPA is DERIVED from cost/conversions, NOT forecast independently
    const buildForecast = (hwC: any, hwV: any) => {
      const cost30 = hwC ? sumArr(hwC.forecast.slice(0, 30)) : sumArr(costSeries.slice(-7)) / 7 * 30;
      const cost90 = hwC ? sumArr(hwC.forecast.slice(0, 90)) : sumArr(costSeries.slice(-7)) / 7 * 90;
      const conv30 = hwV ? sumArr(hwV.forecast.slice(0, 30)) : sumArr(convSeries.slice(-7)) / 7 * 30;
      const conv90 = hwV ? sumArr(hwV.forecast.slice(0, 90)) : sumArr(convSeries.slice(-7)) / 7 * 90;
      const cpa30 = conv30 > 0 ? cost30 / conv30 : null;
      const cpa90 = conv90 > 0 ? cost90 / conv90 : null;

      // CI for cost
      const cost30CI = hwC ? {
        lower: sumArr(hwC.forecastCI80.slice(0, 30).map((c: any) => c.lower)),
        upper: sumArr(hwC.forecastCI80.slice(0, 30).map((c: any) => c.upper)),
      } : null;
      const cost90CI = hwC ? {
        lower: sumArr(hwC.forecastCI80.slice(0, 90).map((c: any) => c.lower)),
        upper: sumArr(hwC.forecastCI80.slice(0, 90).map((c: any) => c.upper)),
      } : null;

      // CI for conversions
      const conv30CI = hwV ? {
        lower: sumArr(hwV.forecastCI80.slice(0, 30).map((c: any) => c.lower)),
        upper: sumArr(hwV.forecastCI80.slice(0, 30).map((c: any) => c.upper)),
      } : null;
      const conv90CI = hwV ? {
        lower: sumArr(hwV.forecastCI80.slice(0, 90).map((c: any) => c.lower)),
        upper: sumArr(hwV.forecastCI80.slice(0, 90).map((c: any) => c.upper)),
      } : null;

      // CPA CI (conservative): lower CPA = lower cost / upper conversions
      const cpa30CI = (cost30CI && conv30CI && conv30CI.upper > 0 && conv30CI.lower > 0) ? {
        lower: round2(cost30CI.lower / conv30CI.upper),
        upper: round2(cost30CI.upper / Math.max(conv30CI.lower, 0.01)),
      } : null;
      const cpa90CI = (cost90CI && conv90CI && conv90CI.upper > 0 && conv90CI.lower > 0) ? {
        lower: round2(cost90CI.lower / conv90CI.upper),
        upper: round2(cost90CI.upper / Math.max(conv90CI.lower, 0.01)),
      } : null;

      return {
        cost_30d: round2(cost30),
        cost_90d: round2(cost90),
        conversions_30d: round2(conv30),
        conversions_90d: round2(conv90),
        cpa_30d: cpa30 !== null ? round2(cpa30) : null,
        cpa_90d: cpa90 !== null ? round2(cpa90) : null,
        cost_slope: hwC ? round2(hwC.trend) : 0,
        conv_slope: hwV ? round2(hwV.trend) : 0,
        cpa_slope: null as number | null, // derived, not independently modeled
        cost_30d_ci80: cost30CI ? { lower: round2(cost30CI.lower), upper: round2(cost30CI.upper) } : null,
        cost_90d_ci80: cost90CI ? { lower: round2(cost90CI.lower), upper: round2(cost90CI.upper) } : null,
        conversions_30d_ci80: conv30CI ? { lower: round2(conv30CI.lower), upper: round2(conv30CI.upper) } : null,
        conversions_90d_ci80: conv90CI ? { lower: round2(conv90CI.lower), upper: round2(conv90CI.upper) } : null,
        cpa_30d_ci80: cpa30CI,
        cpa_90d_ci80: cpa90CI,
        cost_seasonal: hwC ? hwC.seasonalPattern.map((v: number) => round3(v)) : null,
        conversions_seasonal: hwV ? hwV.seasonalPattern.map((v: number) => round3(v)) : null,
        model_quality: {
          cost_rmse: hwC ? round2(hwC.rmse) : null,
          cost_mape: hwC ? round2(hwC.mape) : null,
          conversions_rmse: hwV ? round2(hwV.rmse) : null,
          conversions_mape: hwV ? round2(hwV.mape) : null,
        },
      };
    };

    const forecast = buildForecast(hwCost, hwConv);

    // Filter trend rows to requested date range for display
    const trendRows = allRows.filter((r: any) => r.snapshot_date >= params.dateFrom && r.snapshot_date <= params.dateTo);

    return { trend: trendRows, forecast };
  }

  /**
   * Salud de escalamiento (scaling health).
   *
   * Agregación semanal con crecimiento week-over-week usando LAG().
   * Para cada semana calcula:
   * - weekly_cost, weekly_conversions, weekly_cpa
   * - cost_growth_pct: % cambio vs semana anterior
   * - conv_growth_pct: % cambio en conversiones vs semana anterior
   *
   * Permite evaluar si al aumentar gasto las conversiones también crecen
   * (escalamiento saludable) o si el CPA se dispara (rendimientos decrecientes).
   *
   * Tablas: google_ads_snapshots JOIN campaigns
   *
   * @param params.dateFrom   - Fecha inicio.
   * @param params.dateTo     - Fecha fin.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Array de semanas con métricas y % de crecimiento.
   */
  async getScalingHealth(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const conditions: string[] = ['gs.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;
    if (params.accountId) { conditions.push(`c.customer_account_id = $${paramIdx}`); values.push(params.accountId); paramIdx++; }
    if (params.countryId) { conditions.push(`c.country_id = $${paramIdx}`); values.push(params.countryId); paramIdx++; }

    const sql = `
      WITH weekly AS (
        SELECT
          DATE_TRUNC('week', gs.snapshot_date)::date AS week_start,
          SUM(gs.cost) AS weekly_cost,
          SUM(gs.conversions) AS weekly_conversions,
          CASE WHEN SUM(gs.conversions) > 0
            THEN ROUND((SUM(gs.cost) / SUM(gs.conversions))::numeric, 2)
            ELSE NULL END AS weekly_cpa
        FROM google_ads_snapshots gs
        JOIN campaigns c ON c.id = gs.campaign_id
        WHERE ${conditions.join(' AND ')}
        GROUP BY DATE_TRUNC('week', gs.snapshot_date)
        ORDER BY week_start
      )
      SELECT
        week_start,
        weekly_cost,
        weekly_conversions,
        weekly_cpa,
        ROUND(((weekly_cost - LAG(weekly_cost) OVER (ORDER BY week_start)) / NULLIF(LAG(weekly_cost) OVER (ORDER BY week_start), 0) * 100)::numeric, 2) AS cost_growth_pct,
        ROUND(((weekly_conversions - LAG(weekly_conversions) OVER (ORDER BY week_start)) / NULLIF(LAG(weekly_conversions) OVER (ORDER BY week_start), 0) * 100)::numeric, 2) AS conv_growth_pct
      FROM weekly
    `;
    const result = await query(sql, values);
    return result.rows;
  }

  /**
   * Tendencia del mercado competitivo.
   *
   * Métricas diarias del entorno competitivo:
   * - avg_impression_share: IS propia (%)
   * - avg_cpc: CPC promedio diario
   * - total_impressions, total_clicks
   * - avg_budget_lost_is: IS perdida por presupuesto insuficiente (%)
   * - avg_rank_lost_is: IS perdida por bajo Ad Rank (%)
   *
   * Filtro: search_impression_share IS NOT NULL
   * Tablas: google_ads_snapshots JOIN campaigns
   *
   * @param params.dateFrom   - Fecha inicio.
   * @param params.dateTo     - Fecha fin.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Array de filas diarias con métricas de mercado.
   */
  async getCompetitiveMarketTrend(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const conditions: string[] = ['gs.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;
    if (params.accountId) { conditions.push(`c.customer_account_id = $${paramIdx}`); values.push(params.accountId); paramIdx++; }
    if (params.countryId) { conditions.push(`c.country_id = $${paramIdx}`); values.push(params.countryId); paramIdx++; }

    const sql = `
      SELECT
        gs.snapshot_date,
        ROUND(AVG(gs.search_impression_share * 100)::numeric, 2) AS avg_impression_share,
        CASE WHEN SUM(gs.clicks) > 0
          THEN ROUND((SUM(gs.cost) / SUM(gs.clicks))::numeric, 2)
          ELSE 0 END AS avg_cpc,
        SUM(gs.impressions) AS total_impressions,
        SUM(gs.clicks) AS total_clicks,
        ROUND(AVG(gs.search_budget_lost_is * 100)::numeric, 2) AS avg_budget_lost_is,
        ROUND(AVG(gs.search_rank_lost_is * 100)::numeric, 2) AS avg_rank_lost_is
      FROM google_ads_snapshots gs
      JOIN campaigns c ON c.id = gs.campaign_id
      WHERE ${conditions.join(' AND ')}
        AND gs.search_impression_share IS NOT NULL
      GROUP BY gs.snapshot_date
      ORDER BY gs.snapshot_date
    `;
    const result = await query(sql, values);
    return result.rows;
  }

  // ============ Phase 10: Dashboard Ejecutivo ============

  /**
   * Health Score 0-100 por cuenta.
   *
   * Fórmula del score compuesto (100 puntos máximo):
   * - CPA (25 pts): 25 si CPA <= promedio, se reduce proporcionalmente si es mayor.
   * - ConvRate (25 pts): LEAST(25, conversion_rate × 5).
   * - Waste (20 pts): 20 menos el % de gasto desperdiciado (campañas sin conversiones).
   * - IS (15 pts): LEAST(15, avg_impression_share / 100 × 15).
   * - Base (15 pts): puntos base asegurados.
   *
   * Status:
   * - HEALTHY: score >= 80
   * - ATTENTION: score >= 50
   * - CRITICAL: score < 50
   *
   * CTEs: account_metrics, waste_by_account, global_avg.
   * Tablas: google_ads_snapshots, campaigns, countries
   *
   * @param params.dateFrom   - Fecha inicio.
   * @param params.dateTo     - Fecha fin.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Array de cuentas con health_score (0-100) y status.
   */
  async getAccountHealthScores(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const conditions: string[] = ['gs.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;
    if (params.accountId) { conditions.push(`c.customer_account_id = $${paramIdx}`); values.push(params.accountId); paramIdx++; }
    if (params.countryId) { conditions.push(`c.country_id = $${paramIdx}`); values.push(params.countryId); paramIdx++; }

    const sql = `
      WITH account_metrics AS (
        SELECT
          c.customer_account_id,
          c.customer_account_name,
          co.name AS country_name,
          SUM(gs.cost) AS total_cost,
          SUM(gs.clicks) AS total_clicks,
          SUM(gs.conversions) AS total_conversions,
          CASE WHEN SUM(gs.conversions) > 0
            THEN ROUND((SUM(gs.cost) / SUM(gs.conversions))::numeric, 2)
            ELSE NULL END AS cpa,
          CASE WHEN SUM(gs.clicks) > 0
            THEN ROUND((SUM(gs.conversions) / SUM(gs.clicks) * 100)::numeric, 2)
            ELSE 0 END AS conversion_rate,
          ROUND(AVG(COALESCE(gs.search_impression_share, 0) * 100)::numeric, 2) AS avg_impression_share
        FROM google_ads_snapshots gs
        JOIN campaigns c ON c.id = gs.campaign_id
        LEFT JOIN countries co ON co.id = c.country_id
        WHERE ${conditions.join(' AND ')}
        GROUP BY c.customer_account_id, c.customer_account_name, co.name
        HAVING SUM(gs.cost) > 0
      ),
      waste_by_account AS (
        SELECT
          c.customer_account_id,
          SUM(CASE WHEN sub.total_conversions = 0 THEN sub.total_cost ELSE 0 END) AS wasted_cost,
          SUM(sub.total_cost) AS account_total_cost
        FROM (
          SELECT c.customer_account_id, c.id, SUM(gs.cost) AS total_cost, SUM(gs.conversions) AS total_conversions
          FROM google_ads_snapshots gs
          JOIN campaigns c ON c.id = gs.campaign_id
          WHERE ${conditions.join(' AND ')}
          GROUP BY c.customer_account_id, c.id
        ) sub
        JOIN campaigns c ON c.id = sub.id
        GROUP BY c.customer_account_id
      ),
      global_avg AS (
        SELECT ROUND(AVG(cpa)::numeric, 2) AS avg_cpa FROM account_metrics WHERE cpa IS NOT NULL
      )
      SELECT
        am.customer_account_id,
        am.customer_account_name,
        am.country_name,
        am.total_cost,
        am.total_conversions,
        am.cpa,
        am.conversion_rate,
        am.avg_impression_share,
        ROUND((COALESCE(wa.wasted_cost, 0) / NULLIF(wa.account_total_cost, 0) * 100)::numeric, 1) AS waste_pct,
        ga.avg_cpa,
        ROUND((
          CASE WHEN am.cpa IS NOT NULL AND ga.avg_cpa > 0 AND am.cpa <= ga.avg_cpa THEN 25 WHEN am.cpa IS NOT NULL AND ga.avg_cpa > 0 THEN GREATEST(0, 25 - (am.cpa - ga.avg_cpa) / ga.avg_cpa * 25) ELSE 0 END +
          LEAST(25, am.conversion_rate * 5) +
          CASE WHEN wa.account_total_cost > 0 THEN GREATEST(0, 20 - COALESCE(wa.wasted_cost, 0) / wa.account_total_cost * 20) ELSE 20 END +
          LEAST(15, am.avg_impression_share / 100 * 15) +
          15
        )::numeric, 0) AS health_score,
        CASE
          WHEN ROUND((
            CASE WHEN am.cpa IS NOT NULL AND ga.avg_cpa > 0 AND am.cpa <= ga.avg_cpa THEN 25 WHEN am.cpa IS NOT NULL AND ga.avg_cpa > 0 THEN GREATEST(0, 25 - (am.cpa - ga.avg_cpa) / ga.avg_cpa * 25) ELSE 0 END +
            LEAST(25, am.conversion_rate * 5) +
            CASE WHEN wa.account_total_cost > 0 THEN GREATEST(0, 20 - COALESCE(wa.wasted_cost, 0) / wa.account_total_cost * 20) ELSE 20 END +
            LEAST(15, am.avg_impression_share / 100 * 15) +
            15
          )::numeric, 0) >= 80 THEN 'HEALTHY'
          WHEN ROUND((
            CASE WHEN am.cpa IS NOT NULL AND ga.avg_cpa > 0 AND am.cpa <= ga.avg_cpa THEN 25 WHEN am.cpa IS NOT NULL AND ga.avg_cpa > 0 THEN GREATEST(0, 25 - (am.cpa - ga.avg_cpa) / ga.avg_cpa * 25) ELSE 0 END +
            LEAST(25, am.conversion_rate * 5) +
            CASE WHEN wa.account_total_cost > 0 THEN GREATEST(0, 20 - COALESCE(wa.wasted_cost, 0) / wa.account_total_cost * 20) ELSE 20 END +
            LEAST(15, am.avg_impression_share / 100 * 15) +
            15
          )::numeric, 0) >= 50 THEN 'ATTENTION'
          ELSE 'CRITICAL'
        END AS status
      FROM account_metrics am
      LEFT JOIN waste_by_account wa ON wa.customer_account_id = am.customer_account_id
      CROSS JOIN global_avg ga
      ORDER BY health_score DESC
    `;
    const result = await query(sql, values);
    return result.rows;
  }

  /**
   * Resumen ejecutivo.
   *
   * Compara automáticamente el periodo actual vs el periodo anterior
   * (de igual duración, calculado restando la misma cantidad de días).
   *
   * Retorna:
   * - summary: total_cost, total_clicks, total_conversions, avg_cpa, avg_cpc, avg_ctr
   *   + prev_cost, prev_conversions, prev_cpa
   *   + cost_delta_pct, conv_delta_pct, cpa_delta_pct
   * - wins: Top 3 cuentas por conversiones (con CPA).
   * - problems: Top 3 peores cuentas (gasto > $100, 0 conversiones).
   *
   * CTEs: current_period, prev_period, top_accounts, worst_accounts.
   * Tablas: google_ads_snapshots JOIN campaigns
   *
   * @param params.dateFrom   - Fecha inicio del periodo actual.
   * @param params.dateTo     - Fecha fin del periodo actual.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Objeto {summary, wins, problems}.
   */
  async getExecutiveSummary(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const conditions: string[] = ['gs.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;
    if (params.accountId) { conditions.push(`c.customer_account_id = $${paramIdx}`); values.push(params.accountId); paramIdx++; }
    if (params.countryId) { conditions.push(`c.country_id = $${paramIdx}`); values.push(params.countryId); paramIdx++; }

    const sql = `
      WITH current_period AS (
        SELECT
          SUM(gs.cost) AS total_cost,
          SUM(gs.clicks) AS total_clicks,
          SUM(gs.conversions) AS total_conversions,
          CASE WHEN SUM(gs.conversions) > 0
            THEN ROUND((SUM(gs.cost) / SUM(gs.conversions))::numeric, 2)
            ELSE 0 END AS avg_cpa,
          CASE WHEN SUM(gs.clicks) > 0
            THEN ROUND((SUM(gs.cost) / SUM(gs.clicks))::numeric, 2)
            ELSE 0 END AS avg_cpc,
          CASE WHEN SUM(gs.impressions) > 0
            THEN ROUND((SUM(gs.clicks)::numeric / SUM(gs.impressions) * 100)::numeric, 2)
            ELSE 0 END AS avg_ctr
        FROM google_ads_snapshots gs
        JOIN campaigns c ON c.id = gs.campaign_id
        WHERE ${conditions.join(' AND ')}
      ),
      prev_period AS (
        SELECT
          SUM(gs.cost) AS total_cost,
          SUM(gs.clicks) AS total_clicks,
          SUM(gs.conversions) AS total_conversions,
          CASE WHEN SUM(gs.conversions) > 0
            THEN ROUND((SUM(gs.cost) / SUM(gs.conversions))::numeric, 2)
            ELSE 0 END AS avg_cpa
        FROM google_ads_snapshots gs
        JOIN campaigns c ON c.id = gs.campaign_id
        WHERE gs.snapshot_date BETWEEN ($1::date - ($2::date - $1::date)) AND ($1::date - 1)
          ${params.accountId ? `AND c.customer_account_id = $${paramIdx - (params.countryId ? 2 : 1)}` : ''}
          ${params.countryId ? `AND c.country_id = $${paramIdx - 1}` : ''}
      ),
      top_accounts AS (
        SELECT
          c.customer_account_id,
          c.customer_account_name,
          SUM(gs.conversions) AS total_conv,
          CASE WHEN SUM(gs.conversions) > 0
            THEN ROUND((SUM(gs.cost) / SUM(gs.conversions))::numeric, 2)
            ELSE NULL END AS cpa
        FROM google_ads_snapshots gs
        JOIN campaigns c ON c.id = gs.campaign_id
        WHERE ${conditions.join(' AND ')}
        GROUP BY c.customer_account_id, c.customer_account_name
        HAVING SUM(gs.cost) > 0
        ORDER BY SUM(gs.conversions) DESC
        LIMIT 3
      ),
      worst_accounts AS (
        SELECT
          c.customer_account_id,
          c.customer_account_name,
          SUM(gs.cost) AS total_cost,
          SUM(gs.conversions) AS total_conv
        FROM google_ads_snapshots gs
        JOIN campaigns c ON c.id = gs.campaign_id
        WHERE ${conditions.join(' AND ')}
        GROUP BY c.customer_account_id, c.customer_account_name
        HAVING SUM(gs.cost) > 100 AND SUM(gs.conversions) = 0
        ORDER BY SUM(gs.cost) DESC
        LIMIT 3
      )
      SELECT
        json_build_object(
          'total_cost', cp.total_cost,
          'total_clicks', cp.total_clicks,
          'total_conversions', cp.total_conversions,
          'avg_cpa', cp.avg_cpa,
          'avg_cpc', cp.avg_cpc,
          'avg_ctr', cp.avg_ctr,
          'prev_cost', pp.total_cost,
          'prev_conversions', pp.total_conversions,
          'prev_cpa', pp.avg_cpa,
          'cost_delta_pct', CASE WHEN pp.total_cost > 0 THEN ROUND(((cp.total_cost - pp.total_cost) / pp.total_cost * 100)::numeric, 1) ELSE NULL END,
          'conv_delta_pct', CASE WHEN pp.total_conversions > 0 THEN ROUND(((cp.total_conversions - pp.total_conversions) / pp.total_conversions * 100)::numeric, 1) ELSE NULL END,
          'cpa_delta_pct', CASE WHEN pp.avg_cpa > 0 THEN ROUND(((cp.avg_cpa - pp.avg_cpa) / pp.avg_cpa * 100)::numeric, 1) ELSE NULL END
        ) AS summary,
        (SELECT json_agg(json_build_object('account', customer_account_name, 'conversions', total_conv, 'cpa', cpa)) FROM top_accounts) AS wins,
        (SELECT json_agg(json_build_object('account', customer_account_name, 'cost', total_cost, 'conversions', total_conv)) FROM worst_accounts) AS problems
    FROM current_period cp
    CROSS JOIN prev_period pp
    `;
    const result = await query(sql, values);
    return result.rows[0] || { summary: {}, wins: [], problems: [] };
  }

  /**
   * Top 5 recomendaciones por estimated_savings.
   *
   * Combina 3 fuentes de recomendaciones mediante UNION:
   * 1. PAUSE_CAMPAIGN: campañas sin conversiones con gasto > $50
   * 2. EXCLUDE_DEVICE: dispositivos sin conversiones con gasto > $20
   * 3. ADD_NEGATIVE: términos de búsqueda sin conversiones con gasto > $30
   *
   * Cada recomendación incluye: action_type, target_name, account_name,
   * estimated_savings y description en español.
   * Ordenado por estimated_savings DESC, LIMIT 5.
   *
   * Tablas: google_ads_snapshots, google_ads_device_snapshots,
   *         google_ads_search_term_snapshots, campaigns
   *
   * @param params.dateFrom   - Fecha inicio.
   * @param params.dateTo     - Fecha fin.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Array de hasta 5 recomendaciones con action_type y estimated_savings.
   */
  async getTopRecommendations(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const conditions: string[] = ['gs.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;
    if (params.accountId) { conditions.push(`c.customer_account_id = $${paramIdx}`); values.push(params.accountId); paramIdx++; }
    if (params.countryId) { conditions.push(`c.country_id = $${paramIdx}`); values.push(params.countryId); paramIdx++; }

    const sql = `
      WITH waste_campaigns AS (
        SELECT
          'PAUSE_CAMPAIGN' AS action_type,
          c.name AS target_name,
          c.customer_account_name AS account_name,
          SUM(gs.cost) AS estimated_savings,
          'Campana sin conversiones con alto gasto' AS description
        FROM google_ads_snapshots gs
        JOIN campaigns c ON c.id = gs.campaign_id
        WHERE ${conditions.join(' AND ')}
        GROUP BY c.name, c.customer_account_name
        HAVING SUM(gs.conversions) = 0 AND SUM(gs.cost) > 50
        ORDER BY SUM(gs.cost) DESC
        LIMIT 5
      ),
      device_waste AS (
        SELECT
          'EXCLUDE_DEVICE' AS action_type,
          ${EnumMappingService.getDeviceCaseSQL('ds.device')} || ' en ' || c.customer_account_name AS target_name,
          c.customer_account_name AS account_name,
          SUM(ds.cost) AS estimated_savings,
          'Dispositivo sin conversiones' AS description
        FROM google_ads_device_snapshots ds
        JOIN campaigns c ON c.id = ds.campaign_id
        WHERE ds.snapshot_date BETWEEN $1 AND $2
          ${params.accountId ? `AND c.customer_account_id = $${values.indexOf(params.accountId) + 1}` : ''}
          ${params.countryId ? `AND c.country_id = $${values.indexOf(params.countryId) + 1}` : ''}
        GROUP BY ds.device, c.customer_account_name
        HAVING SUM(ds.conversions) = 0 AND SUM(ds.cost) > 20
        ORDER BY SUM(ds.cost) DESC
        LIMIT 3
      ),
      negative_kws AS (
        SELECT
          'ADD_NEGATIVE' AS action_type,
          st.search_term AS target_name,
          '' AS account_name,
          SUM(st.cost) AS estimated_savings,
          'Termino de busqueda sin conversiones' AS description
        FROM google_ads_search_term_snapshots st
        JOIN campaigns c ON c.id = st.campaign_id
        WHERE st.snapshot_date BETWEEN $1 AND $2
          ${params.accountId ? `AND c.customer_account_id = $${values.indexOf(params.accountId) + 1}` : ''}
          ${params.countryId ? `AND c.country_id = $${values.indexOf(params.countryId) + 1}` : ''}
        GROUP BY st.search_term
        HAVING SUM(st.conversions) = 0 AND SUM(st.cost) > 30
        ORDER BY SUM(st.cost) DESC
        LIMIT 5
      ),
      all_recs AS (
        SELECT * FROM waste_campaigns
        UNION ALL SELECT * FROM device_waste
        UNION ALL SELECT * FROM negative_kws
      )
      SELECT action_type, target_name, account_name, ROUND(estimated_savings::numeric, 2) AS estimated_savings, description
      FROM all_recs
      ORDER BY estimated_savings DESC
      LIMIT 5
    `;
    const result = await query(sql, values);
    return result.rows;
  }

  // ============ Phase 11: Auditoria Financiera ============

  /**
   * Keywords zombie: activas >= 7 días, gasto > $10, 0 conversiones.
   *
   * Estas son keywords que llevan tiempo activas consumiendo presupuesto
   * sin generar ninguna conversión. Requieren revisión urgente.
   *
   * Tabla: google_ads_keyword_snapshots JOIN campaigns
   * HAVING: SUM(conversions) = 0 AND SUM(cost) > 10 AND COUNT(DISTINCT snapshot_date) >= 7
   * Top 100 por costo total.
   * Incluye: account_names, campaign_names (STRING_AGG), days_active, ctr, avg_qs.
   *
   * @param params.dateFrom   - Fecha inicio.
   * @param params.dateTo     - Fecha fin.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Array de keywords zombie ordenadas por total_cost DESC.
   */
  async getZombieKeywords(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const conditions: string[] = ['ks.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;
    if (params.accountId) { conditions.push(`c.customer_account_id = $${paramIdx}`); values.push(params.accountId); paramIdx++; }
    if (params.countryId) { conditions.push(`c.country_id = $${paramIdx}`); values.push(params.countryId); paramIdx++; }

    const sql = `
      SELECT
        ks.keyword_text,
        ks.match_type,
        STRING_AGG(DISTINCT c.customer_account_name, ', ') AS account_names,
        STRING_AGG(DISTINCT c.name, ', ') AS campaign_names,
        COUNT(DISTINCT ks.snapshot_date) AS days_active,
        SUM(ks.cost) AS total_cost,
        SUM(ks.clicks) AS total_clicks,
        SUM(ks.impressions) AS total_impressions,
        SUM(ks.conversions) AS total_conversions,
        CASE WHEN SUM(ks.impressions) > 0
          THEN ROUND((SUM(ks.clicks)::numeric / SUM(ks.impressions) * 100)::numeric, 2)
          ELSE 0 END AS ctr,
        ROUND(AVG(ks.quality_score)::numeric, 1) AS avg_qs
      FROM google_ads_keyword_snapshots ks
      JOIN campaigns c ON c.id = ks.campaign_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY ks.keyword_text, ks.match_type
      HAVING SUM(ks.conversions) = 0 AND SUM(ks.cost) > 10 AND COUNT(DISTINCT ks.snapshot_date) >= 7
      ORDER BY SUM(ks.cost) DESC
      LIMIT 100
    `;
    const result = await query(sql, values);
    return result.rows;
  }

  /**
   * Campañas vampiro: consumen desproporcionadamente el presupuesto.
   *
   * Criterio: campañas que consumen > 40% del presupuesto de la cuenta
   * pero generan < 20% de las conversiones.
   *
   * vampire_score = budget_share_pct - conversion_share_pct
   * (cuanto mayor, más "vampírica" es la campaña).
   *
   * CTEs: campaign_metrics (métricas por campaña), account_totals (totales por cuenta).
   * Tablas: google_ads_snapshots JOIN campaigns
   * Filtro: account_conversions > 0 (solo cuentas con conversiones).
   *
   * @param params.dateFrom   - Fecha inicio.
   * @param params.dateTo     - Fecha fin.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Array de campañas vampiro con budget_share_pct, conversion_share_pct, vampire_score.
   */
  async getVampireCampaigns(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const conditions: string[] = ['gs.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;
    if (params.accountId) { conditions.push(`c.customer_account_id = $${paramIdx}`); values.push(params.accountId); paramIdx++; }
    if (params.countryId) { conditions.push(`c.country_id = $${paramIdx}`); values.push(params.countryId); paramIdx++; }

    const sql = `
      WITH campaign_metrics AS (
        SELECT
          c.id AS campaign_id,
          c.name AS campaign_name,
          c.customer_account_id,
          c.customer_account_name,
          SUM(gs.cost) AS campaign_cost,
          SUM(gs.conversions) AS campaign_conversions
        FROM google_ads_snapshots gs
        JOIN campaigns c ON c.id = gs.campaign_id
        WHERE ${conditions.join(' AND ')}
        GROUP BY c.id, c.name, c.customer_account_id, c.customer_account_name
        HAVING SUM(gs.cost) > 0
      ),
      account_totals AS (
        SELECT
          customer_account_id,
          SUM(campaign_cost) AS account_cost,
          SUM(campaign_conversions) AS account_conversions
        FROM campaign_metrics
        GROUP BY customer_account_id
      )
      SELECT
        cm.campaign_id,
        cm.campaign_name,
        cm.customer_account_id,
        cm.customer_account_name,
        cm.campaign_cost,
        cm.campaign_conversions,
        at.account_cost,
        at.account_conversions,
        ROUND((cm.campaign_cost / NULLIF(at.account_cost, 0) * 100)::numeric, 1) AS budget_share_pct,
        ROUND((cm.campaign_conversions / NULLIF(at.account_conversions, 0) * 100)::numeric, 1) AS conversion_share_pct,
        ROUND((cm.campaign_cost / NULLIF(at.account_cost, 0) * 100 - cm.campaign_conversions / NULLIF(at.account_conversions, 0) * 100)::numeric, 1) AS vampire_score
      FROM campaign_metrics cm
      JOIN account_totals at ON at.customer_account_id = cm.customer_account_id
      WHERE at.account_conversions > 0
        AND ROUND((cm.campaign_cost / NULLIF(at.account_cost, 0) * 100)::numeric, 1) > 40
        AND ROUND((cm.campaign_conversions / NULLIF(at.account_conversions, 0) * 100)::numeric, 1) < 20
      ORDER BY (cm.campaign_cost / NULLIF(at.account_cost, 0) * 100 - cm.campaign_conversions / NULLIF(at.account_conversions, 0) * 100) DESC
    `;
    const result = await query(sql, values);
    return result.rows;
  }

  /**
   * Plan de acción consolidado.
   *
   * Combina 3 tipos de acciones mediante UNION ALL:
   * 1. PAUSAR_CAMPANA: campañas sin conversiones con gasto > $50 (prioridad 1)
   * 2. AGREGAR_NEGATIVA: search terms sin conversiones con gasto > $20 (prioridad 2)
   * 3. EXCLUIR_DISPOSITIVO: dispositivos sin conversiones con gasto > $10 (prioridad 3)
   *
   * Cada acción incluye: action_type, target_name, account_name,
   * current_cost, estimated_monthly_savings, priority.
   * Ordenado por estimated_monthly_savings DESC. Top 50.
   *
   * Tablas: google_ads_snapshots, google_ads_search_term_snapshots,
   *         google_ads_device_snapshots, campaigns
   *
   * @param params.dateFrom   - Fecha inicio.
   * @param params.dateTo     - Fecha fin.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Array de acciones con estimated_monthly_savings, ordenado DESC.
   */
  async getConsolidatedActionPlan(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const conditions: string[] = ['gs.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;
    if (params.accountId) { conditions.push(`c.customer_account_id = $${paramIdx}`); values.push(params.accountId); paramIdx++; }
    if (params.countryId) { conditions.push(`c.country_id = $${paramIdx}`); values.push(params.countryId); paramIdx++; }

    // Build conditions for other tables
    const stConditions = conditions.map(cond => cond.replace('gs.snapshot_date', 'st.snapshot_date'));
    const dsConditions = conditions.map(cond => cond.replace('gs.snapshot_date', 'ds.snapshot_date'));

    const sql = `
      WITH pause_campaigns AS (
        SELECT
          'PAUSAR_CAMPANA' AS action_type,
          c.name AS target_name,
          c.customer_account_name AS account_name,
          SUM(gs.cost) AS current_cost,
          SUM(gs.cost) AS estimated_monthly_savings,
          1 AS priority
        FROM google_ads_snapshots gs
        JOIN campaigns c ON c.id = gs.campaign_id
        WHERE ${conditions.join(' AND ')}
        GROUP BY c.name, c.customer_account_name
        HAVING SUM(gs.conversions) = 0 AND SUM(gs.cost) > 50
      ),
      add_negatives AS (
        SELECT
          'AGREGAR_NEGATIVA' AS action_type,
          st.search_term AS target_name,
          STRING_AGG(DISTINCT c.customer_account_name, ', ') AS account_name,
          SUM(st.cost) AS current_cost,
          SUM(st.cost) AS estimated_monthly_savings,
          2 AS priority
        FROM google_ads_search_term_snapshots st
        JOIN campaigns c ON c.id = st.campaign_id
        WHERE ${stConditions.join(' AND ')}
        GROUP BY st.search_term
        HAVING SUM(st.conversions) = 0 AND SUM(st.cost) > 20
      ),
      exclude_devices AS (
        SELECT
          'EXCLUIR_DISPOSITIVO' AS action_type,
          ${EnumMappingService.getDeviceCaseSQL('ds.device')} || ' (' || c.customer_account_name || ')' AS target_name,
          c.customer_account_name AS account_name,
          SUM(ds.cost) AS current_cost,
          SUM(ds.cost) AS estimated_monthly_savings,
          3 AS priority
        FROM google_ads_device_snapshots ds
        JOIN campaigns c ON c.id = ds.campaign_id
        WHERE ${dsConditions.join(' AND ')}
        GROUP BY ds.device, c.customer_account_name
        HAVING SUM(ds.conversions) = 0 AND SUM(ds.cost) > 10
      ),
      all_actions AS (
        SELECT * FROM pause_campaigns
        UNION ALL SELECT * FROM add_negatives
        UNION ALL SELECT * FROM exclude_devices
      )
      SELECT
        action_type,
        target_name,
        account_name,
        ROUND(current_cost::numeric, 2) AS current_cost,
        ROUND(estimated_monthly_savings::numeric, 2) AS estimated_monthly_savings,
        priority
      FROM all_actions
      ORDER BY estimated_monthly_savings DESC
      LIMIT 50
    `;
    const result = await query(sql, values);
    return result.rows;
  }

  // ============ Phase 12: Benchmark Cross-Account ============

  /**
   * Benchmark de cuentas con ranking y cuartiles.
   *
   * efficiency_score = (conversions / cost) × 1000
   * Cuartiles vía NTILE(4): TOP (Q1), MID (Q2-Q3), BOTTOM (Q4).
   *
   * Métricas por cuenta: campaign_count, total_cost, total_clicks,
   * total_conversions, CPA, conversion_rate, efficiency_score,
   * avg_is (Impression Share), budget_utilization.
   *
   * budget_utilization = (total_cost / (dias × avg_daily_budget)) × 100
   *
   * CTEs: account_perf → ranked (ROW_NUMBER, NTILE).
   * Tablas: google_ads_snapshots, campaigns, countries
   *
   * @param params.dateFrom   - Fecha inicio.
   * @param params.dateTo     - Fecha fin.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Array de cuentas con rank, tier (TOP/MID/BOTTOM) y efficiency_score.
   */
  async getAccountBenchmark(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const conditions: string[] = ['gs.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;
    if (params.accountId) { conditions.push(`c.customer_account_id = $${paramIdx}`); values.push(params.accountId); paramIdx++; }
    if (params.countryId) { conditions.push(`c.country_id = $${paramIdx}`); values.push(params.countryId); paramIdx++; }

    const sql = `
      WITH account_perf AS (
        SELECT
          c.customer_account_id,
          c.customer_account_name,
          co.name AS country_name,
          COUNT(DISTINCT c.id) AS campaign_count,
          SUM(gs.cost) AS total_cost,
          SUM(gs.clicks) AS total_clicks,
          SUM(gs.conversions) AS total_conversions,
          CASE WHEN SUM(gs.conversions) > 0
            THEN ROUND((SUM(gs.cost) / SUM(gs.conversions))::numeric, 2)
            ELSE NULL END AS cpa,
          CASE WHEN SUM(gs.clicks) > 0
            THEN ROUND((SUM(gs.conversions) / SUM(gs.clicks)::numeric * 100)::numeric, 2)
            ELSE 0 END AS conversion_rate,
          CASE WHEN SUM(gs.cost) > 0
            THEN ROUND((SUM(gs.conversions) / SUM(gs.cost)::numeric * 1000)::numeric, 4)
            ELSE 0 END AS efficiency_score,
          ROUND(AVG(COALESCE(gs.search_impression_share, 0) * 100)::numeric, 2) AS avg_is,
          ROUND(AVG(COALESCE(gs.daily_budget, 0))::numeric, 2) AS avg_daily_budget,
          CASE WHEN AVG(COALESCE(gs.daily_budget, 0)) > 0
            THEN ROUND((SUM(gs.cost) / (COUNT(DISTINCT gs.snapshot_date) * AVG(COALESCE(gs.daily_budget, 0))) * 100)::numeric, 1)
            ELSE 0 END AS budget_utilization
        FROM google_ads_snapshots gs
        JOIN campaigns c ON c.id = gs.campaign_id
        LEFT JOIN countries co ON co.id = c.country_id
        WHERE ${conditions.join(' AND ')}
        GROUP BY c.customer_account_id, c.customer_account_name, co.name
        HAVING SUM(gs.cost) > 0
      ),
      ranked AS (
        SELECT *,
          ROW_NUMBER() OVER (ORDER BY efficiency_score DESC) AS rank_asc,
          ROW_NUMBER() OVER (ORDER BY efficiency_score ASC) AS rank_desc,
          COUNT(*) OVER () AS total_accounts,
          NTILE(4) OVER (ORDER BY efficiency_score DESC) AS quartile
        FROM account_perf
      )
      SELECT
        customer_account_id,
        customer_account_name,
        country_name,
        campaign_count,
        total_cost,
        total_clicks,
        total_conversions,
        cpa,
        conversion_rate,
        efficiency_score,
        avg_is,
        budget_utilization,
        rank_asc AS rank,
        total_accounts,
        CASE
          WHEN quartile = 1 THEN 'TOP'
          WHEN quartile IN (2, 3) THEN 'MID'
          ELSE 'BOTTOM'
        END AS tier
      FROM ranked
      ORDER BY efficiency_score DESC
    `;
    const result = await query(sql, values);
    return result.rows;
  }

  /**
   * Recomendación de portfolio de cuentas.
   *
   * Clasifica cuentas y calcula suma acumulada de conversiones ordenando
   * por eficiencia (efficiency_score DESC):
   * - STOP: 0 conversiones + gasto > $100 → detener inversión
   * - KEEP: eficiencia > 0 → mantener y potenciar
   * - REVIEW: resto → requiere revisión
   *
   * Incluye cumulative_conversions y cumulative_cost para análisis de Pareto.
   *
   * Tablas: google_ads_snapshots JOIN campaigns LEFT JOIN countries
   *
   * @param params.dateFrom   - Fecha inicio.
   * @param params.dateTo     - Fecha fin.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Array de cuentas con recommendation (STOP/KEEP/REVIEW) y acumulados.
   */
  async getPortfolioRecommendation(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const conditions: string[] = ['gs.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;
    if (params.accountId) { conditions.push(`c.customer_account_id = $${paramIdx}`); values.push(params.accountId); paramIdx++; }
    if (params.countryId) { conditions.push(`c.country_id = $${paramIdx}`); values.push(params.countryId); paramIdx++; }

    const sql = `
      WITH account_perf AS (
        SELECT
          c.customer_account_id,
          c.customer_account_name,
          co.name AS country_name,
          SUM(gs.cost) AS total_cost,
          SUM(gs.conversions) AS total_conversions,
          CASE WHEN SUM(gs.conversions) > 0
            THEN ROUND((SUM(gs.cost) / SUM(gs.conversions))::numeric, 2)
            ELSE NULL END AS cpa,
          CASE WHEN SUM(gs.cost) > 0
            THEN ROUND((SUM(gs.conversions) / SUM(gs.cost)::numeric * 1000)::numeric, 4)
            ELSE 0 END AS efficiency_score
        FROM google_ads_snapshots gs
        JOIN campaigns c ON c.id = gs.campaign_id
        LEFT JOIN countries co ON co.id = c.country_id
        WHERE ${conditions.join(' AND ')}
        GROUP BY c.customer_account_id, c.customer_account_name, co.name
        HAVING SUM(gs.cost) > 0
      ),
      totals AS (
        SELECT SUM(total_conversions) AS grand_total_conv, SUM(total_cost) AS grand_total_cost FROM account_perf
      ),
      cumulative AS (
        SELECT
          ap.*,
          t.grand_total_conv,
          t.grand_total_cost,
          SUM(ap.total_conversions) OVER (ORDER BY ap.efficiency_score DESC) AS cumsum_conv,
          ROUND((SUM(ap.total_conversions) OVER (ORDER BY ap.efficiency_score DESC) / NULLIF(t.grand_total_conv, 0) * 100)::numeric, 1) AS cumsum_conv_pct,
          CASE
            WHEN ap.total_conversions = 0 AND ap.total_cost > 100 THEN 'STOP'
            WHEN ap.efficiency_score > 0 THEN 'KEEP'
            ELSE 'REVIEW'
          END AS recommendation
        FROM account_perf ap
        CROSS JOIN totals t
      )
      SELECT
        customer_account_id,
        customer_account_name,
        country_name,
        total_cost,
        total_conversions,
        cpa,
        efficiency_score,
        cumsum_conv_pct,
        recommendation
      FROM cumulative
      ORDER BY efficiency_score DESC
    `;
    const result = await query(sql, values);
    return result.rows;
  }

  /**
   * Patrones de cuentas agrupados en 3 tiers.
   *
   * Usa NTILE(3) sobre efficiency_score para clasificar cuentas en:
   * - TOP_25: mejor tercio
   * - MID_50: tercio medio
   * - BOTTOM_25: peor tercio
   *
   * Métricas promedio por tier: avg_cost, avg_conversions, avg_cpa,
   * avg_campaigns, avg_conv_rate, avg_impression_share.
   * Incluye: common_channel (MODE del channel_type predominante),
   * common_bidding_strategy (MODE del bidding_strategy_type).
   *
   * Tablas: google_ads_snapshots JOIN campaigns
   *
   * @param params.dateFrom   - Fecha inicio.
   * @param params.dateTo     - Fecha fin.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Array de 3 filas (TOP_25, MID_50, BOTTOM_25) con métricas promedio.
   */
  async getAccountPatterns(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const conditions: string[] = ['gs.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;
    if (params.accountId) { conditions.push(`c.customer_account_id = $${paramIdx}`); values.push(params.accountId); paramIdx++; }
    if (params.countryId) { conditions.push(`c.country_id = $${paramIdx}`); values.push(params.countryId); paramIdx++; }

    const sql = `
      WITH account_perf AS (
        SELECT
          c.customer_account_id,
          SUM(gs.cost) AS total_cost,
          SUM(gs.conversions) AS total_conversions,
          CASE WHEN SUM(gs.cost) > 0
            THEN ROUND((SUM(gs.conversions) / SUM(gs.cost)::numeric * 1000)::numeric, 4)
            ELSE 0 END AS efficiency_score,
          COUNT(DISTINCT c.id) AS campaign_count,
          MODE() WITHIN GROUP (ORDER BY c.channel_type) AS predominant_channel,
          MODE() WITHIN GROUP (ORDER BY c.bidding_strategy_type) AS predominant_bidding,
          ROUND(AVG(COALESCE(gs.search_impression_share, 0) * 100)::numeric, 2) AS avg_is,
          CASE WHEN SUM(gs.clicks) > 0
            THEN ROUND((SUM(gs.conversions) / SUM(gs.clicks)::numeric * 100)::numeric, 2)
            ELSE 0 END AS avg_conv_rate,
          CASE WHEN SUM(gs.conversions) > 0
            THEN ROUND((SUM(gs.cost) / SUM(gs.conversions))::numeric, 2)
            ELSE NULL END AS avg_cpa
        FROM google_ads_snapshots gs
        JOIN campaigns c ON c.id = gs.campaign_id
        WHERE ${conditions.join(' AND ')}
        GROUP BY c.customer_account_id
        HAVING SUM(gs.cost) > 0
      ),
      tiered AS (
        SELECT *,
          NTILE(3) OVER (ORDER BY efficiency_score DESC) AS tier_num
        FROM account_perf
      )
      SELECT
        CASE tier_num WHEN 1 THEN 'TOP_25' WHEN 2 THEN 'MID_50' ELSE 'BOTTOM_25' END AS tier,
        COUNT(*) AS account_count,
        ROUND(AVG(total_cost)::numeric, 2) AS avg_cost,
        ROUND(AVG(total_conversions)::numeric, 1) AS avg_conversions,
        ROUND(AVG(avg_cpa)::numeric, 2) AS avg_cpa,
        ROUND(AVG(campaign_count)::numeric, 1) AS avg_campaigns,
        ROUND(AVG(avg_conv_rate)::numeric, 2) AS avg_conv_rate,
        ROUND(AVG(avg_is)::numeric, 2) AS avg_impression_share,
        MODE() WITHIN GROUP (ORDER BY predominant_channel) AS common_channel,
        MODE() WITHIN GROUP (ORDER BY predominant_bidding) AS common_bidding_strategy
      FROM tiered
      GROUP BY tier_num
      ORDER BY tier_num
    `;
    const result = await query(sql, values);
    return result.rows;
  }

  // ========== ML Predictive Budget Analysis ==========

  // ========== Wave 4: Landing Pages, Funnel, Month Comparison ==========

  /**
   * Rendimiento por landing page (final_url).
   *
   * Tabla: google_ads_ad_snapshots JOIN campaigns
   * Filtro: final_url IS NOT NULL AND final_url != ''
   * Agrupa por final_url.
   * Métricas: ad_count, campaign_count, total_clicks, total_impressions,
   * total_cost, total_conversions, CPC, CTR, CPA.
   * Ordenado por total_cost DESC. Top 50.
   *
   * @param params.dateFrom   - Fecha inicio.
   * @param params.dateTo     - Fecha fin.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Array de landing pages con métricas de rendimiento.
   */
  async getLandingPageAnalysis(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const conditions: string[] = ['ads.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'", "ads.final_url IS NOT NULL", "ads.final_url != ''"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;

    if (params.accountId) { conditions.push(`c.customer_account_id = $${paramIdx}`); values.push(params.accountId); paramIdx++; }
    paramIdx = this.addAccountIdsFilter(conditions, values, paramIdx, params.accountIds);
    if (params.countryId) { conditions.push(`c.country_id = $${paramIdx}`); values.push(params.countryId); paramIdx++; }

    const sql = `
      SELECT
        ads.final_url,
        COUNT(DISTINCT ads.ad_id) AS ad_count,
        COUNT(DISTINCT c.id) AS campaign_count,
        SUM(ads.clicks)::int AS total_clicks,
        SUM(ads.impressions)::int AS total_impressions,
        SUM(ads.cost)::numeric AS total_cost,
        SUM(ads.conversions)::numeric AS total_conversions,
        CASE WHEN SUM(ads.clicks) > 0
          THEN ROUND(SUM(ads.cost) / SUM(ads.clicks), 2) ELSE 0 END AS cpc,
        CASE WHEN SUM(ads.impressions) > 0
          THEN ROUND((SUM(ads.clicks)::numeric / SUM(ads.impressions)) * 100, 2) ELSE 0 END AS ctr,
        CASE WHEN SUM(ads.conversions) > 0
          THEN ROUND((SUM(ads.cost) / SUM(ads.conversions))::numeric, 2) ELSE 0 END AS cpa,
        CASE WHEN SUM(ads.clicks) > 0
          THEN ROUND((SUM(ads.conversions)::numeric / SUM(ads.clicks)) * 100, 2) ELSE 0 END AS conversion_rate
      FROM google_ads_ad_snapshots ads
      JOIN campaigns c ON c.id = ads.campaign_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY ads.final_url
      ORDER BY SUM(ads.cost) DESC
      LIMIT 50
    `;

    const result = await query(sql, values);
    return result.rows;
  }

  /**
   * Funnel de conversión por campaña.
   *
   * Para cada campaña muestra el embudo: impressions -> clicks -> conversions.
   * Tasas de paso entre cada etapa:
   * - click_rate = (clicks / impressions) × 100 (CTR)
   * - conversion_rate = (conversions / clicks) × 100
   * - overall_rate = (conversions / impressions) × 100
   *
   * Tablas: google_ads_snapshots JOIN campaigns
   * Filtro: HAVING SUM(impressions) > 0
   * Top 30 campañas por impresiones DESC.
   *
   * @param params.dateFrom   - Fecha inicio.
   * @param params.dateTo     - Fecha fin.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Array de campañas con métricas del funnel.
   */
  async getConversionFunnel(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const conditions: string[] = ['gs.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;

    if (params.accountId) { conditions.push(`c.customer_account_id = $${paramIdx}`); values.push(params.accountId); paramIdx++; }
    paramIdx = this.addAccountIdsFilter(conditions, values, paramIdx, params.accountIds);
    if (params.countryId) { conditions.push(`c.country_id = $${paramIdx}`); values.push(params.countryId); paramIdx++; }

    const sql = `
      SELECT
        c.name AS campaign_name,
        c.customer_account_name,
        SUM(gs.impressions)::int AS impressions,
        SUM(gs.clicks)::int AS clicks,
        SUM(gs.conversions)::numeric AS conversions,
        CASE WHEN SUM(gs.impressions) > 0
          THEN ROUND((SUM(gs.clicks)::numeric / SUM(gs.impressions)) * 100, 2) ELSE 0 END AS click_rate,
        CASE WHEN SUM(gs.clicks) > 0
          THEN ROUND((SUM(gs.conversions)::numeric / SUM(gs.clicks)) * 100, 2) ELSE 0 END AS conversion_rate,
        CASE WHEN SUM(gs.impressions) > 0
          THEN ROUND((SUM(gs.conversions)::numeric / SUM(gs.impressions)) * 100, 4) ELSE 0 END AS overall_rate,
        SUM(gs.cost)::numeric AS total_cost
      FROM google_ads_snapshots gs
      JOIN campaigns c ON c.id = gs.campaign_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY c.name, c.customer_account_name
      HAVING SUM(gs.impressions) > 0
      ORDER BY SUM(gs.impressions) DESC
      LIMIT 30
    `;

    const result = await query(sql, values);
    return result.rows;
  }

  /**
   * Comparación mes a mes (Month-over-Month).
   *
   * Auto-calcula el periodo anterior de igual duración.
   * Ejemplo: si el rango es 30 días, compara con los 30 días inmediatamente anteriores.
   *
   * Calcula deltas % para todas las métricas:
   * cost, clicks, impressions, conversions, CPC, CTR, CPA.
   * Fórmula delta: ((current - previous) / previous) × 100
   *
   * Para métricas "inversas" (cost, CPC, CPA), un delta positivo es negativo para el negocio.
   *
   * CTEs: current_period, previous_period.
   * Tablas: google_ads_snapshots JOIN campaigns
   *
   * @param params.dateFrom   - Fecha inicio del periodo actual.
   * @param params.dateTo     - Fecha fin del periodo actual.
   * @param params.accountId  - (Opcional) Cuenta específica.
   * @param params.accountIds - (Opcional) Lista de cuentas (pautador).
   * @param params.countryId  - (Opcional) Filtrar por país.
   * @returns Objeto {period: {current, previous, days}, metrics: [{name, current, previous, delta}]}.
   */
  async getMonthOverMonthComparison(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    // Calculate current and previous period
    const from = new Date(params.dateFrom);
    const to = new Date(params.dateTo);
    const periodDays = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    const prevTo = new Date(from);
    prevTo.setDate(prevTo.getDate() - 1);
    const prevFrom = new Date(prevTo);
    prevFrom.setDate(prevFrom.getDate() - periodDays);

    const buildConditions = (paramStart: number) => {
      const conds: string[] = ["c.ads_status = 'ENABLED'"];
      const vals: any[] = [];
      let idx = paramStart;

      if (params.accountId) { conds.push(`c.customer_account_id = $${idx}`); vals.push(params.accountId); idx++; }
      idx = this.addAccountIdsFilter(conds, vals, idx, params.accountIds);
      if (params.countryId) { conds.push(`c.country_id = $${idx}`); vals.push(params.countryId); idx++; }
      return { conds, vals, idx };
    };

    const { conds, vals } = buildConditions(5);
    const allValues = [
      params.dateFrom, params.dateTo,
      prevFrom.toISOString().split('T')[0], prevTo.toISOString().split('T')[0],
      ...vals,
    ];

    const accountFilter = conds.length > 1 ? ' AND ' + conds.slice(1).join(' AND ') : '';

    const sql = `
      WITH current_period AS (
        SELECT
          SUM(gs.cost)::numeric AS cost,
          SUM(gs.clicks)::int AS clicks,
          SUM(gs.impressions)::int AS impressions,
          SUM(gs.conversions)::numeric AS conversions,
          CASE WHEN SUM(gs.clicks) > 0 THEN ROUND(SUM(gs.cost) / SUM(gs.clicks), 2) ELSE 0 END AS cpc,
          CASE WHEN SUM(gs.impressions) > 0 THEN ROUND((SUM(gs.clicks)::numeric / SUM(gs.impressions)) * 100, 2) ELSE 0 END AS ctr,
          CASE WHEN SUM(gs.conversions) > 0 THEN ROUND((SUM(gs.cost) / SUM(gs.conversions))::numeric, 2) ELSE 0 END AS cpa
        FROM google_ads_snapshots gs
        JOIN campaigns c ON c.id = gs.campaign_id
        WHERE gs.snapshot_date BETWEEN $1 AND $2 AND c.ads_status = 'ENABLED'${accountFilter}
      ),
      previous_period AS (
        SELECT
          SUM(gs.cost)::numeric AS cost,
          SUM(gs.clicks)::int AS clicks,
          SUM(gs.impressions)::int AS impressions,
          SUM(gs.conversions)::numeric AS conversions,
          CASE WHEN SUM(gs.clicks) > 0 THEN ROUND(SUM(gs.cost) / SUM(gs.clicks), 2) ELSE 0 END AS cpc,
          CASE WHEN SUM(gs.impressions) > 0 THEN ROUND((SUM(gs.clicks)::numeric / SUM(gs.impressions)) * 100, 2) ELSE 0 END AS ctr,
          CASE WHEN SUM(gs.conversions) > 0 THEN ROUND((SUM(gs.cost) / SUM(gs.conversions))::numeric, 2) ELSE 0 END AS cpa
        FROM google_ads_snapshots gs
        JOIN campaigns c ON c.id = gs.campaign_id
        WHERE gs.snapshot_date BETWEEN $3 AND $4 AND c.ads_status = 'ENABLED'${accountFilter}
      )
      SELECT
        cp.cost AS current_cost, pp.cost AS previous_cost,
        cp.clicks AS current_clicks, pp.clicks AS previous_clicks,
        cp.impressions AS current_impressions, pp.impressions AS previous_impressions,
        cp.conversions AS current_conversions, pp.conversions AS previous_conversions,
        cp.cpc AS current_cpc, pp.cpc AS previous_cpc,
        cp.ctr AS current_ctr, pp.ctr AS previous_ctr,
        cp.cpa AS current_cpa, pp.cpa AS previous_cpa
      FROM current_period cp, previous_period pp
    `;

    const result = await query(sql, allValues);
    const row = result.rows[0] || {};

    const calcDelta = (curr: number, prev: number) => {
      if (!prev || prev === 0) return curr > 0 ? 100 : 0;
      return Number(((curr - prev) / prev * 100).toFixed(1));
    };

    return {
      period: {
        current: { from: params.dateFrom, to: params.dateTo },
        previous: { from: prevFrom.toISOString().split('T')[0], to: prevTo.toISOString().split('T')[0] },
        days: periodDays,
      },
      metrics: [
        { name: 'Costo', current: Number(row.current_cost) || 0, previous: Number(row.previous_cost) || 0, delta: calcDelta(Number(row.current_cost), Number(row.previous_cost)), format: 'currency', inverse: true },
        { name: 'Clicks', current: Number(row.current_clicks) || 0, previous: Number(row.previous_clicks) || 0, delta: calcDelta(Number(row.current_clicks), Number(row.previous_clicks)), format: 'number' },
        { name: 'Impresiones', current: Number(row.current_impressions) || 0, previous: Number(row.previous_impressions) || 0, delta: calcDelta(Number(row.current_impressions), Number(row.previous_impressions)), format: 'number' },
        { name: 'Conversiones', current: Number(row.current_conversions) || 0, previous: Number(row.previous_conversions) || 0, delta: calcDelta(Number(row.current_conversions), Number(row.previous_conversions)), format: 'decimal' },
        { name: 'CPC', current: Number(row.current_cpc) || 0, previous: Number(row.previous_cpc) || 0, delta: calcDelta(Number(row.current_cpc), Number(row.previous_cpc)), format: 'currency', inverse: true },
        { name: 'CTR', current: Number(row.current_ctr) || 0, previous: Number(row.previous_ctr) || 0, delta: calcDelta(Number(row.current_ctr), Number(row.previous_ctr)), format: 'percent' },
        { name: 'CPA', current: Number(row.current_cpa) || 0, previous: Number(row.previous_cpa) || 0, delta: calcDelta(Number(row.current_cpa), Number(row.previous_cpa)), format: 'currency', inverse: true },
      ],
    };
  }

  /**
   * Análisis predictivo de presupuesto.
   *
   * Delega completamente a predictiveBudgetService.getPredictiveAnalysis().
   * Ver predictive-budget.service.ts para detalles de implementación.
   *
   * @param params.accountId - ID de la cuenta a analizar.
   * @param params.dateFrom  - Fecha inicio del rango histórico.
   * @param params.dateTo    - Fecha fin del rango histórico.
   * @returns Resultado del análisis predictivo (forecast, recomendaciones, etc.).
   */
  async getPredictiveAnalysis(params: {
    accountId: string;
    dateFrom: string;
    dateTo: string;
  }) {
    return predictiveBudgetService.getPredictiveAnalysis({
      accountId: params.accountId,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
    });
  }
}

// ── Helpers used by forecast methods ──
function round2(v: number): number { return Math.round(v * 100) / 100; }
function round3(v: number): number { return Math.round(v * 1000) / 1000; }
function sumArr(arr: number[]): number { return arr.reduce((s, v) => s + v, 0); }

export const googleAdsAnalysisService = new GoogleAdsAnalysisService();
