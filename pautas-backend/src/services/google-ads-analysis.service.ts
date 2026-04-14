import { query } from '../config/database';
import { EnumMappingService } from './enum-mapping.service';
import { predictiveBudgetService } from './predictive-budget.service';

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
  async getImpressionShareTrend(params: {
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

  async getCampaignTypeBreakdown(params: {
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

  async getBiddingStrategyAnalysis(params: {
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

  async getTopKeywords(params: {
    dateFrom: string;
    dateTo: string;
    metric?: string;
    matchType?: string;
    accountId?: string;
    countryId?: number;
    limit?: number;
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

    const conditions: string[] = ['kw.snapshot_date BETWEEN $1 AND $2'];
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
    if (params.countryId) {
      conditions.push(`c.country_id = $${paramIdx}`);
      values.push(params.countryId);
      paramIdx++;
    }

    values.push(limitVal);

    const sql = `
      SELECT
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
      GROUP BY kw.keyword_text, kw.match_type
      ORDER BY sort_value DESC
      LIMIT $${paramIdx}
    `;

    const result = await query(sql, values);
    return result.rows;
  }

  async getKeywordQualityDistribution(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    countryId?: number;
  }) {
    const conditions: string[] = ['kw.snapshot_date BETWEEN $1 AND $2'];
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

  async getDeviceBreakdown(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    countryId?: number;
  }) {
    const conditions: string[] = ['ds.snapshot_date BETWEEN $1 AND $2'];
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

  async getGeoPerformance(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    countryId?: number;
    limit?: number;
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

    const limitVal = params.limit || 20;
    values.push(limitVal);

    const sql = `
      SELECT
        gs.geo_target_name,
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
        END AS ctr
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

  // ========== Budget Intelligence ==========

  async getBudgetPacing(params: {
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
          COALESCE(ab.avg_cpa, 0) AS account_avg_cpa,
          COALESCE(ab.avg_cpc, 0) AS account_avg_cpc
        FROM google_ads_snapshots gs
        JOIN campaigns c ON c.id = gs.campaign_id
        LEFT JOIN countries co ON co.id = c.country_id
        LEFT JOIN account_budgets ab ON ab.customer_account_id = c.customer_account_id
        WHERE ${conditions.join(' AND ')}
        GROUP BY c.customer_account_id, c.customer_account_name, co.name, ab.total_daily_budget, ab.avg_cpa, ab.avg_cpc
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
          account_avg_cpc,
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
          -- Smart budget recommendation
          CASE
            WHEN total_conversions = 0 AND total_cost > 0 THEN
              -- No conversions: reduce by 50%
              ROUND((total_daily_budget * 0.5)::numeric, 2)
            WHEN total_conversions > 0 AND total_cost > 0 THEN
              -- Has conversions: calculate optimal based on target (10 conversions/month)
              ROUND(((total_conversions / days_with_data) * 30 * (total_cost / NULLIF(total_conversions, 0)) / 10)::numeric, 2)
            WHEN total_clicks > 0 AND total_cost > 0 THEN
              -- Has clicks but no conversions: assess for optimization
              ROUND((total_daily_budget * 0.7)::numeric, 2)
            ELSE
              -- No data: maintain current
              total_daily_budget
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
          WHEN pacing_pct <= 80 AND recommended_daily_budget > total_daily_budget
            THEN 'Increase budget - under-pacing'
          WHEN pacing_pct >= 120 AND recommended_daily_budget < total_daily_budget
            THEN 'Reduce budget - over-pacing'
          WHEN recommended_daily_budget > total_daily_budget
            THEN 'Increase budget for better ROI'
          WHEN recommended_daily_budget < total_daily_budget
            THEN 'Reduce budget - low conversion rate'
          ELSE 'On-track - maintain budget'
        END AS budget_status,
        ROUND((recommended_daily_budget - total_daily_budget)::numeric, 2) AS budget_adjustment
      FROM with_recommendations
      ORDER BY total_cost DESC
    `;

    const result = await query(sql, values);
    return result.rows;
  }

  async getWasteDetection(params: {
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

  async getOptimalSchedule(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    countryId?: number;
  }) {
    const conditions: string[] = ['hs.snapshot_date BETWEEN $1 AND $2'];
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
        hs.hour_of_day,
        hs.day_of_week,
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
      GROUP BY hs.hour_of_day, hs.day_of_week
      ORDER BY hs.day_of_week, hs.hour_of_day
    `;

    const result = await query(sql, values);
    return result.rows;
  }

  async getBudgetForecast(params: {
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

    // Get daily cost time series
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
    const rows = result.rows;

    if (rows.length < 3) {
      return { trend: rows, forecast: null };
    }

    // Linear regression on daily cost
    const n = rows.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
      const x = i;
      const y = Number(rows[i].daily_cost) || 0;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    }
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Average daily cost
    const avgDailyCost = sumY / n;

    // Project forward
    const projected7d = Math.max(0, Math.round((intercept + slope * (n + 3)) * 7 * 100) / 100);
    const projected14d = Math.max(0, Math.round((intercept + slope * (n + 7)) * 14 * 100) / 100);
    const projected30d = Math.max(0, Math.round((intercept + slope * (n + 15)) * 30 * 100) / 100);

    return {
      trend: rows,
      forecast: {
        avg_daily_cost: Math.round(avgDailyCost * 100) / 100,
        slope: Math.round(slope * 100) / 100,
        trend_direction: slope > 0.5 ? 'increasing' : slope < -0.5 ? 'decreasing' : 'stable',
        projected_7d: projected7d,
        projected_14d: projected14d,
        projected_30d: projected30d,
        data_points: n,
      },
    };
  }

  async getBudgetRedistribution(params: {
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

  async getSmartBudgetRecommendations(params: {
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
          END AS cpc
        FROM google_ads_snapshots gs
        JOIN campaigns c ON c.id = gs.campaign_id
        LEFT JOIN countries co ON co.id = c.country_id
        WHERE ${conditions.join(' AND ')}
        GROUP BY c.id, c.name, c.customer_account_id, c.customer_account_name, co.name, c.daily_budget
        HAVING SUM(gs.cost) > 0
      ),
      account_targets AS (
        SELECT
          customer_account_id,
          ROUND(AVG(current_cpa), 2) AS target_cpa,
          ROUND(AVG(ctr), 2) AS avg_ctr
        FROM campaign_analysis
        WHERE current_cpa IS NOT NULL
        GROUP BY customer_account_id
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
        -- Recommended budget based on conversion goals
        CASE
          WHEN ca.total_conversions = 0 THEN ca.current_daily_budget * 0.5  -- Reduce underperforming
          WHEN ca.current_cpa IS NULL THEN ca.current_daily_budget
          WHEN ca.current_cpa <= at.target_cpa * 0.8 THEN ca.current_daily_budget * 1.3  -- High performer, increase
          WHEN ca.current_cpa >= at.target_cpa * 1.5 THEN ca.current_daily_budget * 0.7  -- Low performer, reduce
          ELSE ca.current_daily_budget  -- On target, maintain
        END AS recommended_daily_budget,
        -- Expected conversions with new budget
        CASE
          WHEN ca.total_conversions > 0 AND ca.days_with_data > 0
            THEN ROUND((ca.total_conversions / ca.days_with_data) * 30, 0)
          ELSE 0
        END AS expected_monthly_conversions,
        -- ROI projection
        CASE
          WHEN ca.total_conversions > 0 AND ca.total_cost > 0
            THEN ROUND(((ca.total_conversions * 50) / ca.total_cost), 2)  -- Assuming $50 value per conversion
          ELSE 0
        END AS projected_roi_multiplier,
        -- Recommendation reason
        CASE
          WHEN ca.total_conversions = 0 THEN 'No conversions - reduce budget'
          WHEN ca.current_cpa IS NULL THEN 'Insufficient data - maintain budget'
          WHEN ca.current_cpa <= at.target_cpa * 0.8 THEN 'High performer - increase budget'
          WHEN ca.current_cpa >= at.target_cpa * 1.5 THEN 'Low performer - reduce budget'
          ELSE 'On target - maintain budget'
        END AS recommendation
      FROM campaign_analysis ca
      LEFT JOIN account_targets at ON at.customer_account_id = ca.customer_account_id
      ORDER BY ca.total_conversions DESC
    `;

    const result = await query(sql, values);
    return result.rows;
  }

  // ========== Hourly Heatmap ==========

  async getHourlyHeatmap(params: {
    dateFrom: string;
    dateTo: string;
    metric?: string;
    accountId?: string;
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

    const conditions: string[] = ['hs.snapshot_date BETWEEN $1 AND $2'];
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
        hs.snapshot_date,
        hs.hour_of_day,
        TO_CHAR(hs.snapshot_date, 'Dy') AS day_name,
        EXTRACT(DOW FROM hs.snapshot_date) AS day_of_week,
        ${metricExpr} AS value
      FROM google_ads_hourly_snapshots hs
      JOIN campaigns c ON c.id = hs.campaign_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY hs.snapshot_date, hs.hour_of_day
      ORDER BY hs.snapshot_date, hs.hour_of_day
    `;

    const result = await query(sql, values);
    return result.rows;
  }

  // ========== Temporal Comparison ==========

  async getTemporalComparison(params: {
    dateFrom1: string;
    dateTo1: string;
    dateFrom2: string;
    dateTo2: string;
    accountId?: string;
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

  async getCPAAnalysis(params: {
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

  async getQualityScoreTrend(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    countryId?: number;
  }) {
    const conditions: string[] = ['ks.snapshot_date BETWEEN $1 AND $2'];
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

  async getCPCTrend(params: {
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

  async getSeasonalityPatterns(params: {
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

  async getSearchTerms(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    countryId?: number;
    limit?: number;
  }) {
    const conditions: string[] = ['st.snapshot_date BETWEEN $1 AND $2'];
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

  async getNegativeKeywordCandidates(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    countryId?: number;
  }) {
    const conditions: string[] = ['st.snapshot_date BETWEEN $1 AND $2'];
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

  async getLongTailAnalysis(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    countryId?: number;
  }) {
    const conditions: string[] = ['st.snapshot_date BETWEEN $1 AND $2'];
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

  async getKeywordCannibalization(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    countryId?: number;
  }) {
    const conditions: string[] = ['ks.snapshot_date BETWEEN $1 AND $2'];
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

  async getAdPerformanceComparison(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    countryId?: number;
  }) {
    const conditions: string[] = ['ads.snapshot_date BETWEEN $1 AND $2'];
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
        c.name AS campaign_name
      FROM google_ads_ad_snapshots ads
      JOIN campaigns c ON c.id = ads.campaign_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY ads.ad_group_id, ads.ad_group_name, ads.ad_id, ads.ad_type,
               ads.headlines, ads.descriptions, ads.final_url, ads.status, c.name
      ORDER BY ads.ad_group_name, SUM(ads.cost) DESC
    `;

    const result = await query(sql, values);
    return result.rows;
  }

  // ========== Ad Fatigue Detection ==========

  async getAdFatigueDetection(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    countryId?: number;
  }) {
    const conditions: string[] = ['ads.snapshot_date BETWEEN $1 AND $2'];
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

  async getAdTypePerformance(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    countryId?: number;
  }) {
    const conditions: string[] = ['ads.snapshot_date BETWEEN $1 AND $2'];
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

  async getAuctionInsightsSummary(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    countryId?: number;
  }) {
    const conditions: string[] = ['ai.snapshot_date BETWEEN $1 AND $2'];
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

  async getCompetitivePosition(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    countryId?: number;
  }) {
    const conditions: string[] = ['ai.snapshot_date BETWEEN $1 AND $2'];
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

  async getMarketOpportunities(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    countryId?: number;
  }) {
    const conditions: string[] = ['ai.snapshot_date BETWEEN $1 AND $2', 'gs.snapshot_date BETWEEN $1 AND $2'];
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

  async getAgeBreakdown(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    countryId?: number;
  }) {
    const conditions: string[] = ['ds.snapshot_date BETWEEN $1 AND $2', "ds.demographic_type = 'AGE'"];
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

  async getGenderBreakdown(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    countryId?: number;
  }) {
    const conditions: string[] = ['ds.snapshot_date BETWEEN $1 AND $2', "ds.demographic_type = 'GENDER'"];
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

  async getDeviceBidRecommendations(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    countryId?: number;
  }) {
    const conditions: string[] = ['ds.snapshot_date BETWEEN $1 AND $2'];
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

  async getDeviceExclusions(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    countryId?: number;
  }) {
    const conditions: string[] = ['ds.snapshot_date BETWEEN $1 AND $2'];
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

  async getGeoTierClassification(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    countryId?: number;
  }) {
    const conditions: string[] = ['gs.snapshot_date BETWEEN $1 AND $2'];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;
    if (params.accountId) { conditions.push(`c.customer_account_id = $${paramIdx}`); values.push(params.accountId); paramIdx++; }
    if (params.countryId) { conditions.push(`c.country_id = $${paramIdx}`); values.push(params.countryId); paramIdx++; }

    const sql = `
      WITH geo_metrics AS (
        SELECT
          gs.geo_target_name,
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

  async getRegionalPatterns(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    countryId?: number;
  }) {
    const conditions: string[] = ['gs.snapshot_date BETWEEN $1 AND $2'];
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

  async getKeywordActionPlan(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    countryId?: number;
  }) {
    const conditions: string[] = ['ks.snapshot_date BETWEEN $1 AND $2'];
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

  async getMatchTypeRecommendations(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    countryId?: number;
  }) {
    const conditions: string[] = ['ks.snapshot_date BETWEEN $1 AND $2'];
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

  async getCrossAccountKeywords(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    countryId?: number;
  }) {
    const conditions: string[] = ['ks.snapshot_date BETWEEN $1 AND $2'];
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

  async getFullForecast(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    countryId?: number;
  }) {
    const conditions: string[] = ['gs.snapshot_date BETWEEN $1 AND $2'];
    const values: any[] = [params.dateFrom, params.dateTo];
    let paramIdx = 3;
    if (params.accountId) { conditions.push(`c.customer_account_id = $${paramIdx}`); values.push(params.accountId); paramIdx++; }
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
    const rows = result.rows;

    if (rows.length < 7) return { trend: rows, forecast: null };

    // Linear regression for cost, conversions, and CPA
    const calcRegression = (data: number[]) => {
      const n = data.length;
      const sumX = data.reduce((s, _, i) => s + i, 0);
      const sumY = data.reduce((s, v) => s + v, 0);
      const sumXY = data.reduce((s, v, i) => s + i * v, 0);
      const sumX2 = data.reduce((s, _, i) => s + i * i, 0);
      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;
      return { slope, intercept };
    };

    const costData = rows.map((r: any) => Number(r.daily_cost));
    const convData = rows.map((r: any) => Number(r.daily_conversions));
    const cpaData = rows.filter((r: any) => r.daily_cpa !== null).map((r: any) => Number(r.daily_cpa));

    const costReg = calcRegression(costData);
    const convReg = calcRegression(convData);
    const cpaReg = cpaData.length >= 7 ? calcRegression(cpaData) : null;

    const n = rows.length;
    const forecast = {
      cost_30d: Math.round((costReg.intercept + costReg.slope * (n + 30)) * 30 * 100) / 100,
      cost_90d: Math.round((costReg.intercept + costReg.slope * (n + 90)) * 90 * 100) / 100,
      conversions_30d: Math.round((convReg.intercept + convReg.slope * (n + 30)) * 30 * 100) / 100,
      conversions_90d: Math.round((convReg.intercept + convReg.slope * (n + 90)) * 90 * 100) / 100,
      cpa_30d: cpaReg ? Math.round((cpaReg.intercept + cpaReg.slope * (n + 30)) * 100) / 100 : null,
      cpa_90d: cpaReg ? Math.round((cpaReg.intercept + cpaReg.slope * (n + 90)) * 100) / 100 : null,
      cost_slope: Math.round(costReg.slope * 100) / 100,
      conv_slope: Math.round(convReg.slope * 100) / 100,
      cpa_slope: cpaReg ? Math.round(cpaReg.slope * 100) / 100 : null,
    };

    return { trend: rows, forecast };
  }

  async getScalingHealth(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    countryId?: number;
  }) {
    const conditions: string[] = ['gs.snapshot_date BETWEEN $1 AND $2'];
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

  async getCompetitiveMarketTrend(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    countryId?: number;
  }) {
    const conditions: string[] = ['gs.snapshot_date BETWEEN $1 AND $2'];
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

  async getAccountHealthScores(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    countryId?: number;
  }) {
    const conditions: string[] = ['gs.snapshot_date BETWEEN $1 AND $2'];
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
          )::numeric, 0) >= 70 THEN 'HEALTHY'
          WHEN ROUND((
            CASE WHEN am.cpa IS NOT NULL AND ga.avg_cpa > 0 AND am.cpa <= ga.avg_cpa THEN 25 WHEN am.cpa IS NOT NULL AND ga.avg_cpa > 0 THEN GREATEST(0, 25 - (am.cpa - ga.avg_cpa) / ga.avg_cpa * 25) ELSE 0 END +
            LEAST(25, am.conversion_rate * 5) +
            CASE WHEN wa.account_total_cost > 0 THEN GREATEST(0, 20 - COALESCE(wa.wasted_cost, 0) / wa.account_total_cost * 20) ELSE 20 END +
            LEAST(15, am.avg_impression_share / 100 * 15) +
            15
          )::numeric, 0) >= 40 THEN 'ATTENTION'
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

  async getExecutiveSummary(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    countryId?: number;
  }) {
    const conditions: string[] = ['gs.snapshot_date BETWEEN $1 AND $2'];
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

  async getTopRecommendations(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    countryId?: number;
  }) {
    const conditions: string[] = ['gs.snapshot_date BETWEEN $1 AND $2'];
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

  async getZombieKeywords(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    countryId?: number;
  }) {
    const conditions: string[] = ['ks.snapshot_date BETWEEN $1 AND $2'];
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

  async getVampireCampaigns(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    countryId?: number;
  }) {
    const conditions: string[] = ['gs.snapshot_date BETWEEN $1 AND $2'];
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

  async getConsolidatedActionPlan(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    countryId?: number;
  }) {
    const conditions: string[] = ['gs.snapshot_date BETWEEN $1 AND $2'];
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

  async getAccountBenchmark(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    countryId?: number;
  }) {
    const conditions: string[] = ['gs.snapshot_date BETWEEN $1 AND $2'];
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

  async getPortfolioRecommendation(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    countryId?: number;
  }) {
    const conditions: string[] = ['gs.snapshot_date BETWEEN $1 AND $2'];
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

  async getAccountPatterns(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    countryId?: number;
  }) {
    const conditions: string[] = ['gs.snapshot_date BETWEEN $1 AND $2'];
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

  async getPredictiveAnalysis(params: {
    accountId: string;
    dateFrom: string;
    dateTo: string;
  }) {
    return predictiveBudgetService.getPredictiveAnalysis({
      accountId: params.accountId,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      daysOfHistoryForRegression: 30,
    });
  }
}

export const googleAdsAnalysisService = new GoogleAdsAnalysisService();
