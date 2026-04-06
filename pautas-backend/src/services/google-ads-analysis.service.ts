import { query } from '../config/database';

export class GoogleAdsAnalysisService {

  async getDataRange() {
    const sql = `
      SELECT MIN(snapshot_date) AS min_date, MAX(snapshot_date) AS max_date,
             COUNT(DISTINCT snapshot_date) AS distinct_dates
      FROM google_ads_snapshots
    `;
    const result = await query(sql, []);
    return result.rows[0] || { min_date: null, max_date: null, distinct_dates: 0 };
  }

  async getSpendingTrend(params: {
    granularity: string;
    dateFrom: string;
    dateTo: string;
    accountId?: string;
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

    const conditions: string[] = ['gs.snapshot_date BETWEEN $1 AND $2'];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;

    if (params.accountId) {
      conditions.push(`c.customer_account_id = $${paramIdx}`);
      values.push(params.accountId);
      paramIdx++;
    }
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

  async getPerformanceMetrics(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    countryId?: number;
  }) {
    const conditions: string[] = ['gs.snapshot_date BETWEEN $1 AND $2'];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;

    if (params.accountId) {
      conditions.push(`c.customer_account_id = $${paramIdx}`);
      values.push(params.accountId);
      paramIdx++;
    }
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

  async getBudgetDistribution(params: { countryId?: number }) {
    const conditions: string[] = [];
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
}

export const googleAdsAnalysisService = new GoogleAdsAnalysisService();
