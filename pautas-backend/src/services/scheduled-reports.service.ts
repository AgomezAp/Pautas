import { query, getClient } from '../config/database';
import { logger } from '../utils/logger.util';
import { googleAdsAnalysisService } from './google-ads-analysis.service';

export class ScheduledReportsService {

  async getAll(userId?: number): Promise<any[]> {
    let sql = 'SELECT * FROM scheduled_reports WHERE 1=1';
    const values: any[] = [];
    if (userId) {
      values.push(userId);
      sql += ` AND created_by = $${values.length}`;
    }
    sql += ' ORDER BY created_at DESC';
    const result = await query(sql, values);
    return result.rows;
  }

  async getById(id: number): Promise<any> {
    const result = await query('SELECT * FROM scheduled_reports WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async create(data: {
    name: string;
    report_type: string;
    frequency: string;
    recipients: string;
    filters?: any;
    format?: string;
    created_by: number;
  }): Promise<any> {
    const result = await query(`
      INSERT INTO scheduled_reports (name, report_type, frequency, recipients, filters, format, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [data.name, data.report_type, data.frequency, data.recipients,
        JSON.stringify(data.filters || {}), data.format || 'PDF', data.created_by]);
    return result.rows[0];
  }

  async update(id: number, data: Partial<{
    name: string;
    report_type: string;
    frequency: string;
    recipients: string;
    filters: any;
    format: string;
    is_active: boolean;
  }>): Promise<any> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    if (data.name !== undefined) { fields.push(`name = $${paramIdx++}`); values.push(data.name); }
    if (data.report_type !== undefined) { fields.push(`report_type = $${paramIdx++}`); values.push(data.report_type); }
    if (data.frequency !== undefined) { fields.push(`frequency = $${paramIdx++}`); values.push(data.frequency); }
    if (data.recipients !== undefined) { fields.push(`recipients = $${paramIdx++}`); values.push(data.recipients); }
    if (data.filters !== undefined) { fields.push(`filters = $${paramIdx++}`); values.push(JSON.stringify(data.filters)); }
    if (data.format !== undefined) { fields.push(`format = $${paramIdx++}`); values.push(data.format); }
    if (data.is_active !== undefined) { fields.push(`is_active = $${paramIdx++}`); values.push(data.is_active); }

    fields.push('updated_at = NOW()');
    values.push(id);

    const result = await query(
      `UPDATE scheduled_reports SET ${fields.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
      values
    );
    return result.rows[0];
  }

  async delete(id: number): Promise<boolean> {
    const result = await query('DELETE FROM scheduled_reports WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  }

  async markSent(id: number): Promise<void> {
    await query('UPDATE scheduled_reports SET last_sent_at = NOW() WHERE id = $1', [id]);
  }

  async getDueReports(frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY'): Promise<any[]> {
    const result = await query(
      'SELECT * FROM scheduled_reports WHERE is_active = TRUE AND frequency = $1',
      [frequency]
    );
    return result.rows;
  }

  async generateReportContent(params: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
    countryId?: number;
  }): Promise<{
    summary: { total_cost: number; total_conversions: number; avg_cpa: number; total_accounts: number };
    spend_vs_conversions: { date: string; cost: number; conversions: number }[];
    wins: string[];
    problems: string[];
    top_actions: { type: string; description: string; estimated_savings: number }[];
    urgent_alerts: string[];
    generated_at: string;
  }> {
    const baseParams = {
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      accountId: params.accountId,
      countryId: params.countryId,
    };

    // Fetch data from existing analysis methods in parallel
    const [performance, spendingTrend, waste, rankings] = await Promise.all([
      googleAdsAnalysisService.getPerformanceMetrics(baseParams).catch(err => {
        logger.warn('[Report] Failed to fetch performance: ' + err.message);
        return [];
      }),
      googleAdsAnalysisService.getSpendingTrend({ ...baseParams, granularity: 'daily' }).catch(err => {
        logger.warn('[Report] Failed to fetch spending trend: ' + err.message);
        return [];
      }),
      googleAdsAnalysisService.getWasteDetection(baseParams).catch(err => {
        logger.warn('[Report] Failed to fetch waste: ' + err.message);
        return [];
      }),
      googleAdsAnalysisService.getAccountRankings({ ...baseParams, metric: 'spend', sort: 'top', limit: 50 }).catch(err => {
        logger.warn('[Report] Failed to fetch rankings: ' + err.message);
        return [];
      }),
    ]);

    // Build summary from performance data
    const totalCost = performance.reduce((sum: number, r: any) => sum + Number(r.total_cost || 0), 0);
    const totalConversions = performance.reduce((sum: number, r: any) => sum + Number(r.total_conversions || 0), 0);
    const avgCpa = totalConversions > 0 ? totalCost / totalConversions : 0;

    // Spend vs conversions from spending trend
    const spendVsConversions = Array.isArray(spendingTrend)
      ? spendingTrend.map((r: any) => ({
          date: r.date || r.snapshot_date,
          cost: Number(r.total_cost || r.cost || 0),
          conversions: Number(r.total_conversions || r.conversions || 0),
        }))
      : [];

    // Identify wins (top performers from rankings)
    const wins: string[] = [];
    const problems: string[] = [];
    if (Array.isArray(rankings)) {
      const sorted = [...rankings].sort((a: any, b: any) => Number(b.total_conversions || 0) - Number(a.total_conversions || 0));
      sorted.slice(0, 3).forEach((r: any) => {
        wins.push(`${r.account_name || r.customer_account_id}: ${Number(r.total_conversions || 0)} conversiones, CPA $${Number(r.avg_cpa || 0).toFixed(2)}`);
      });
      // Bottom performers as problems
      const bottom = sorted.slice(-3).reverse();
      bottom.forEach((r: any) => {
        const cpa = Number(r.avg_cpa || 0);
        if (cpa > avgCpa * 1.5 || Number(r.total_conversions || 0) === 0) {
          problems.push(`${r.account_name || r.customer_account_id}: CPA $${cpa.toFixed(2)} (${avgCpa > 0 ? ((cpa / avgCpa) * 100).toFixed(0) : 'N/A'}% del promedio)`);
        }
      });
    }

    // Top actions from waste detection
    const topActions: { type: string; description: string; estimated_savings: number }[] = [];
    if (Array.isArray(waste)) {
      waste.slice(0, 5).forEach((w: any) => {
        topActions.push({
          type: 'waste',
          description: `${w.campaign_name || 'Campaña'}: $${Number(w.wasted_spend || w.cost || 0).toFixed(2)} desperdicio detectado`,
          estimated_savings: Number(w.wasted_spend || w.cost || 0),
        });
      });
    }

    // Urgent alerts: campaigns with 0 conversions and high spend
    const urgentAlerts: string[] = [];
    if (Array.isArray(rankings)) {
      rankings.forEach((r: any) => {
        if (Number(r.total_conversions || 0) === 0 && Number(r.total_cost || 0) > 100) {
          urgentAlerts.push(`${r.account_name || r.customer_account_id}: $${Number(r.total_cost).toFixed(2)} gastados sin conversiones`);
        }
      });
    }

    return {
      summary: {
        total_cost: Math.round(totalCost * 100) / 100,
        total_conversions: totalConversions,
        avg_cpa: Math.round(avgCpa * 100) / 100,
        total_accounts: Array.isArray(rankings) ? rankings.length : 0,
      },
      spend_vs_conversions: spendVsConversions,
      wins,
      problems,
      top_actions: topActions,
      urgent_alerts: urgentAlerts,
      generated_at: new Date().toISOString(),
    };
  }
}

export const scheduledReportsService = new ScheduledReportsService();
