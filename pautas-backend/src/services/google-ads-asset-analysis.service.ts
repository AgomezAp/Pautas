import { query } from '../config/database';

class GoogleAdsAssetAnalysisService {

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

  async getHeadlinePerformance(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    return this.getAssetPerformanceByType('HEADLINE', params);
  }

  async getDescriptionPerformance(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    return this.getAssetPerformanceByType('DESCRIPTION', params);
  }

  async getSitelinkPerformance(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    accountIds?: string[];
    countryId?: number;
  }) {
    return this.getAssetPerformanceByType('SITELINK', params);
  }

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
