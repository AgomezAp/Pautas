/**
 * ══════════════════════════════════════════════════════════════════════
 *  Google Ads Asset Analysis Service — Análisis de Assets (Extensiones)
 * ══════════════════════════════════════════════════════════════════════
 *
 *  PROPÓSITO:
 *    Queries de solo lectura sobre google_ads_asset_snapshots.
 *    Analiza rendimiento de headlines, descriptions y sitelinks.
 *
 *  TABLA PRINCIPAL: google_ads_asset_snapshots
 *  JOIN: campaigns (para filtros de cuenta/país/status)
 *
 *  MÉTODOS:
 *    ─ getHeadlinePerformance()    → delega a getAssetPerformanceByType('HEADLINE')
 *    ─ getDescriptionPerformance() → delega a getAssetPerformanceByType('DESCRIPTION')
 *    ─ getSitelinkPerformance()    → delega a getAssetPerformanceByType('SITELINK')
 *    ─ getAssetSummary()           → resumen agrupado por asset_type
 *    ─ getAssetPerformanceByType() → query core: agrupa por asset_text, top 50
 * ══════════════════════════════════════════════════════════════════════
 */

import { query } from '../config/database';

class GoogleAdsAssetAnalysisService {

  /**
   * Helper para filtro de cuentas del pautador.
   *
   * Si se proporcionan accountIds, agrega una condición SQL
   * `c.customer_account_id = ANY($N::text[])` al array de condiciones
   * y el valor correspondiente al array de parámetros.
   *
   * @param conditions - Array mutable de condiciones SQL WHERE
   * @param values     - Array mutable de valores para parámetros $N
   * @param paramIdx   - Índice actual del siguiente parámetro disponible
   * @param accountIds - IDs de cuentas de Google Ads del pautador (opcional)
   * @returns El siguiente índice de parámetro disponible (incrementado si se agregó filtro)
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
   * Rendimiento de headlines. Delega a getAssetPerformanceByType('HEADLINE').
   *
   * Retorna los top 50 headlines por costo con métricas de rendimiento.
   *
   * @param params - Filtros de fecha, cuenta, cuentas múltiples y país
   * @returns Array de filas con asset_text, métricas y campañas/cuentas asociadas
   */
  async getHeadlinePerformance(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    return this.getAssetPerformanceByType('HEADLINE', params);
  }

  /**
   * Rendimiento de descriptions. Delega a getAssetPerformanceByType('DESCRIPTION').
   *
   * Retorna los top 50 descriptions por costo con métricas de rendimiento.
   *
   * @param params - Filtros de fecha, cuenta, cuentas múltiples y país
   * @returns Array de filas con asset_text, métricas y campañas/cuentas asociadas
   */
  async getDescriptionPerformance(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    return this.getAssetPerformanceByType('DESCRIPTION', params);
  }

  /**
   * Rendimiento de sitelinks. Delega a getAssetPerformanceByType('SITELINK').
   *
   * Retorna los top 50 sitelinks por costo con métricas de rendimiento.
   *
   * @param params - Filtros de fecha, cuenta, cuentas múltiples y país
   * @returns Array de filas con asset_text, asset_url, métricas y campañas/cuentas asociadas
   */
  async getSitelinkPerformance(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    return this.getAssetPerformanceByType('SITELINK', params);
  }

  /**
   * Resumen agrupado por asset_type.
   *
   * Agrupa todos los assets por tipo (HEADLINE, DESCRIPTION, SITELINK)
   * y calcula métricas consolidadas: asset_count, total_clicks, total_impressions,
   * total_cost, total_conversions, CPC, CTR y CPA.
   * Filtra solo campañas con ads_status = 'ENABLED'.
   * Ordenado por costo total descendente.
   *
   * @param params - Filtros de fecha, cuenta, cuentas múltiples y país
   * @returns Array de filas agrupadas por asset_type con métricas consolidadas
   */
  async getAssetSummary(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const conditions: string[] = ['a.snapshot_date BETWEEN $1 AND $2', "c.ads_status = 'ENABLED'"];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;

    if (params.accountId) { conditions.push(`c.customer_account_id = $${paramIdx}`); values.push(params.accountId); paramIdx++; }
    paramIdx = this.addAccountIdsFilter(conditions, values, paramIdx, params.accountIds);
    if (params.countryId) { conditions.push(`c.country_id = $${paramIdx}`); values.push(params.countryId); paramIdx++; }

    const sql = `
      SELECT
        a.asset_type,
        COUNT(DISTINCT a.asset_id) AS asset_count,
        SUM(a.clicks)::int AS total_clicks,
        SUM(a.impressions)::int AS total_impressions,
        SUM(a.cost)::numeric AS total_cost,
        SUM(a.conversions)::numeric AS total_conversions,
        CASE WHEN SUM(a.clicks) > 0
          THEN ROUND(SUM(a.cost) / SUM(a.clicks), 2) ELSE 0 END AS cpc,
        CASE WHEN SUM(a.impressions) > 0
          THEN ROUND((SUM(a.clicks)::numeric / SUM(a.impressions)) * 100, 2) ELSE 0 END AS ctr,
        CASE WHEN SUM(a.conversions) > 0
          THEN ROUND((SUM(a.cost) / SUM(a.conversions))::numeric, 2) ELSE 0 END AS cpa
      FROM google_ads_asset_snapshots a
      JOIN campaigns c ON c.id = a.campaign_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY a.asset_type
      ORDER BY SUM(a.cost) DESC
    `;

    const result = await query(sql, values);
    return result.rows;
  }

  /**
   * Query core — Rendimiento de assets por tipo específico.
   *
   * Agrupa por asset_text + asset_url. Retorna los top 50 por costo total.
   * Incluye campaign_names y account_names concatenados vía STRING_AGG(DISTINCT ...).
   * Métricas calculadas: CPC, CTR, CPA y conversion_rate.
   * Filtra solo campañas con ads_status = 'ENABLED'.
   *
   * @param assetType - Tipo de asset: 'HEADLINE' | 'DESCRIPTION' | 'SITELINK'
   * @param params    - Filtros de fecha, cuenta, cuentas múltiples y país
   * @returns Array de hasta 50 filas con texto del asset, métricas y campañas/cuentas asociadas
   */
  private async getAssetPerformanceByType(assetType: string, params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    const conditions: string[] = [
      'a.snapshot_date BETWEEN $1 AND $2',
      "c.ads_status = 'ENABLED'",
      `a.asset_type = $3`,
    ];
    const values: any[] = [params.dateFrom, params.dateTo, assetType];
    let paramIdx = 4;

    if (params.accountId) { conditions.push(`c.customer_account_id = $${paramIdx}`); values.push(params.accountId); paramIdx++; }
    paramIdx = this.addAccountIdsFilter(conditions, values, paramIdx, params.accountIds);
    if (params.countryId) { conditions.push(`c.country_id = $${paramIdx}`); values.push(params.countryId); paramIdx++; }

    const sql = `
      SELECT
        a.asset_text,
        a.asset_url,
        COUNT(DISTINCT a.asset_id) AS usage_count,
        COUNT(DISTINCT c.id) AS campaign_count,
        STRING_AGG(DISTINCT c.name, ', ' ORDER BY c.name) AS campaign_names,
        STRING_AGG(DISTINCT c.customer_account_id, ', ' ORDER BY c.customer_account_id) AS account_ids,
        STRING_AGG(DISTINCT c.customer_account_name, ', ' ORDER BY c.customer_account_name) AS account_names,
        SUM(a.clicks)::int AS total_clicks,
        SUM(a.impressions)::int AS total_impressions,
        SUM(a.cost)::numeric AS total_cost,
        SUM(a.conversions)::numeric AS total_conversions,
        CASE WHEN SUM(a.clicks) > 0
          THEN ROUND(SUM(a.cost) / SUM(a.clicks), 2) ELSE 0 END AS cpc,
        CASE WHEN SUM(a.impressions) > 0
          THEN ROUND((SUM(a.clicks)::numeric / SUM(a.impressions)) * 100, 2) ELSE 0 END AS ctr,
        CASE WHEN SUM(a.conversions) > 0
          THEN ROUND((SUM(a.cost) / SUM(a.conversions))::numeric, 2) ELSE 0 END AS cpa,
        CASE WHEN SUM(a.clicks) > 0
          THEN ROUND((SUM(a.conversions)::numeric / SUM(a.clicks)) * 100, 2) ELSE 0 END AS conversion_rate
      FROM google_ads_asset_snapshots a
      JOIN campaigns c ON c.id = a.campaign_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY a.asset_text, a.asset_url
      ORDER BY SUM(a.cost) DESC
      LIMIT 50
    `;

    const result = await query(sql, values);
    return result.rows;
  }
}

export const googleAdsAssetAnalysisService = new GoogleAdsAssetAnalysisService();
