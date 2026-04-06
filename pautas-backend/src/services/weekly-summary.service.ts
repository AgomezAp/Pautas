import { query } from '../config/database';
import { logger } from '../utils/logger.util';
import { getISOWeekInfo } from '../utils/iso-week.util';

export class WeeklySummaryService {
  async computeForEntry(entry: { country_id: number; campaign_id: number | null; user_id: number; iso_year: number; iso_week: number }): Promise<void> {
    await this.computeWeeklySummary(
      entry.country_id,
      entry.campaign_id,
      entry.user_id,
      entry.iso_year,
      entry.iso_week
    );
  }

  async recomputeCurrentWeek(): Promise<void> {
    const now = new Date();
    const { isoWeek, isoYear } = getISOWeekInfo(now);

    logger.info(`Recomputing weekly summaries for ${isoYear}-W${isoWeek}...`);

    // Get all distinct combos for current week
    const combos = await query(
      `SELECT DISTINCT country_id, campaign_id, user_id
       FROM daily_entries
       WHERE iso_year = $1 AND iso_week = $2`,
      [isoYear, isoWeek]
    );

    for (const combo of combos.rows) {
      await this.computeWeeklySummary(
        combo.country_id,
        combo.campaign_id,
        combo.user_id,
        isoYear,
        isoWeek
      );
    }

    // Also recompute previous week
    const prevWeekDate = new Date(now);
    prevWeekDate.setDate(prevWeekDate.getDate() - 7);
    const prev = getISOWeekInfo(prevWeekDate);

    const prevCombos = await query(
      `SELECT DISTINCT country_id, campaign_id, user_id
       FROM daily_entries
       WHERE iso_year = $1 AND iso_week = $2`,
      [prev.isoYear, prev.isoWeek]
    );

    for (const combo of prevCombos.rows) {
      await this.computeWeeklySummary(
        combo.country_id,
        combo.campaign_id,
        combo.user_id,
        prev.isoYear,
        prev.isoWeek
      );
    }

    logger.info(`Weekly summaries recomputed: ${combos.rows.length + prevCombos.rows.length} entries processed`);
  }

  private async computeWeeklySummary(
    countryId: number,
    campaignId: number | null,
    userId: number,
    isoYear: number,
    isoWeek: number
  ): Promise<void> {
    const entryAgg = await query(
      `SELECT
        COUNT(*) as days_with_entries,
        COALESCE(SUM(clientes), 0) as total_clientes,
        COALESCE(SUM(clientes_efectivos), 0) as total_clientes_efectivos,
        COALESCE(SUM(menores), 0) as total_menores
       FROM daily_entries
       WHERE country_id = $1 AND user_id = $2 AND iso_year = $3 AND iso_week = $4
         ${campaignId ? 'AND campaign_id = $5' : ''}`,
      campaignId ? [countryId, userId, isoYear, isoWeek, campaignId] : [countryId, userId, isoYear, isoWeek]
    );

    let totalConversions = 0;
    if (campaignId) {
      const adsAgg = await query(
        `SELECT COALESCE(SUM(conversions), 0) as total_conversions
         FROM google_ads_snapshots
         WHERE campaign_id = $1
           AND EXTRACT(ISOYEAR FROM snapshot_date) = $2
           AND EXTRACT(WEEK FROM snapshot_date) = $3`,
        [campaignId, isoYear, isoWeek]
      );
      totalConversions = parseFloat(adsAgg.rows[0].total_conversions);
    }

    const e = entryAgg.rows[0];
    const totalClientes = parseInt(e.total_clientes);
    const totalEfectivos = parseInt(e.total_clientes_efectivos);
    const daysWithEntries = parseInt(e.days_with_entries);

    const effectivenessRate = totalClientes > 0 ? totalEfectivos / totalClientes : null;
    const conversionRate = totalClientes > 0 ? totalConversions / totalClientes : null;
    const avgDaily = daysWithEntries > 0 ? totalClientes / daysWithEntries : 0;

    await query(
      `INSERT INTO weekly_summaries
        (country_id, campaign_id, user_id, iso_year, iso_week,
         total_clientes, total_clientes_efectivos, total_menores,
         total_conversions, avg_daily_clientes, effectiveness_rate,
         conversion_rate, days_with_entries, computed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
       ON CONFLICT (country_id, campaign_id, user_id, iso_year, iso_week)
       DO UPDATE SET
        total_clientes = EXCLUDED.total_clientes,
        total_clientes_efectivos = EXCLUDED.total_clientes_efectivos,
        total_menores = EXCLUDED.total_menores,
        total_conversions = EXCLUDED.total_conversions,
        avg_daily_clientes = EXCLUDED.avg_daily_clientes,
        effectiveness_rate = EXCLUDED.effectiveness_rate,
        conversion_rate = EXCLUDED.conversion_rate,
        days_with_entries = EXCLUDED.days_with_entries,
        computed_at = NOW()`,
      [
        countryId, campaignId, userId, isoYear, isoWeek,
        totalClientes, totalEfectivos, parseInt(e.total_menores),
        totalConversions, avgDaily, effectivenessRate, conversionRate,
        daysWithEntries,
      ]
    );
  }
}

export const weeklySummaryService = new WeeklySummaryService();
