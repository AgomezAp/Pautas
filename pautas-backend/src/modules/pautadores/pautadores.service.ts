import { query } from '../../config/database';
import { parsePagination, buildPaginationMeta } from '../../utils/pagination.util';

export class PautadoresService {
  private buildWhereClause(queryParams: any) {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (queryParams.country_id) {
      conditions.push(`de.country_id = $${paramIndex++}`);
      params.push(parseInt(queryParams.country_id));
    }
    if (queryParams.campaign_id) {
      conditions.push(`de.campaign_id = $${paramIndex++}`);
      params.push(parseInt(queryParams.campaign_id));
    }
    if (queryParams.date_from) {
      conditions.push(`de.entry_date >= $${paramIndex++}`);
      params.push(queryParams.date_from);
    }
    if (queryParams.date_to) {
      conditions.push(`de.entry_date <= $${paramIndex++}`);
      params.push(queryParams.date_to);
    }
    if (queryParams.iso_year) {
      conditions.push(`de.iso_year = $${paramIndex++}`);
      params.push(parseInt(queryParams.iso_year));
    }
    if (queryParams.iso_week) {
      conditions.push(`de.iso_week = $${paramIndex++}`);
      params.push(parseInt(queryParams.iso_week));
    }

    return { whereClause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '', params, paramIndex };
  }

  async getEntriesDaily(queryParams: any) {
    const { page, limit, offset } = parsePagination(queryParams);
    const { whereClause, params, paramIndex } = this.buildWhereClause(queryParams);

    const countResult = await query(
      `SELECT COUNT(*) FROM daily_entries de ${whereClause}`, params
    );
    const total = parseInt(countResult.rows[0].count);

    const dataParams = [...params, limit, offset];
    const result = await query(
      `SELECT de.*, u.full_name as user_name, u.username,
              c.name as country_name, c.code as country_code,
              camp.name as campaign_name, camp.google_ads_campaign_id
       FROM daily_entries de
       JOIN users u ON u.id = de.user_id
       JOIN countries c ON c.id = de.country_id
       LEFT JOIN campaigns camp ON camp.id = de.campaign_id
       ${whereClause}
       ORDER BY de.entry_date DESC, u.full_name
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      dataParams
    );

    return { data: result.rows, meta: buildPaginationMeta(page, limit, total) };
  }

  async getEntriesWeekly(queryParams: any) {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (queryParams.country_id) {
      conditions.push(`de.country_id = $${paramIndex++}`);
      params.push(parseInt(queryParams.country_id));
    }
    if (queryParams.iso_year) {
      conditions.push(`de.iso_year = $${paramIndex++}`);
      params.push(parseInt(queryParams.iso_year));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT de.iso_year, de.iso_week, de.country_id,
              c.name as country_name,
              COUNT(DISTINCT de.user_id) as users_reporting,
              COUNT(*) as total_entries,
              SUM(de.clientes) as total_clientes,
              SUM(de.clientes_efectivos) as total_clientes_efectivos,
              SUM(de.menores) as total_menores,
              CASE WHEN SUM(de.clientes) > 0
                THEN ROUND(SUM(de.clientes_efectivos)::numeric / SUM(de.clientes)::numeric, 4)
                ELSE 0 END as effectiveness_rate
       FROM daily_entries de
       JOIN countries c ON c.id = de.country_id
       ${whereClause}
       GROUP BY de.iso_year, de.iso_week, de.country_id, c.name
       ORDER BY de.iso_year DESC, de.iso_week DESC`,
      params
    );

    return result.rows;
  }

  async getEntriesWeeklyCalendar(queryParams: any) {
    const isoYear = parseInt(queryParams.iso_year) || new Date().getFullYear();
    const isoWeek = parseInt(queryParams.iso_week) || this.getCurrentISOWeek();
    const countryId = queryParams.country_id ? parseInt(queryParams.country_id) : null;

    // Get the date range for this ISO week (Monday to Sunday)
    const weekDates = this.getISOWeekDates(isoYear, isoWeek);

    // Build conditions
    const conditions = [`de.entry_date >= $1`, `de.entry_date <= $2`];
    const params: any[] = [weekDates[0], weekDates[6]];
    let paramIndex = 3;

    if (countryId) {
      conditions.push(`de.country_id = $${paramIndex++}`);
      params.push(countryId);
    }

    const whereClause = conditions.join(' AND ');

    // Query daily entries grouped by user and day
    const result = await query(
      `SELECT
         de.user_id,
         u.full_name as user_name,
         u.is_active as user_active,
         c.name as country_name,
         c.code as country_code,
         de.entry_date,
         EXTRACT(ISODOW FROM de.entry_date)::int as day_of_week,
         de.clientes,
         de.clientes_efectivos,
         de.menores
       FROM daily_entries de
       JOIN users u ON u.id = de.user_id
       JOIN countries c ON c.id = de.country_id
       WHERE ${whereClause}
       ORDER BY c.name, u.full_name, de.entry_date`,
      params
    );

    // Also get all conglomerado users to show those without entries
    const userConditions = ["u.role_id = (SELECT id FROM roles WHERE name = 'conglomerado')"];
    const userParams: any[] = [];
    let userParamIndex = 1;
    if (countryId) {
      userConditions.push(`u.country_id = $${userParamIndex++}`);
      userParams.push(countryId);
    }

    const usersResult = await query(
      `SELECT u.id, u.full_name, u.is_active,
              c.name as country_name, c.code as country_code
       FROM users u
       JOIN countries c ON c.id = u.country_id
       WHERE ${userConditions.join(' AND ')}
       ORDER BY c.name, u.full_name`,
      userParams
    );

    // Build the calendar grid: group by user
    const userMap = new Map<number, any>();

    // Initialize all users
    for (const user of usersResult.rows) {
      if (!userMap.has(user.id)) {
        userMap.set(user.id, {
          user_id: user.id,
          user_name: user.full_name,
          campaign_active: user.is_active,
          country_name: user.country_name,
          country_code: user.country_code,
          days: { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null, 7: null },
          total_clientes: 0,
          total_efectivos: 0,
          total_menores: 0,
          days_with_entries: 0,
        });
      }
    }

    // Fill in actual entries
    for (const row of result.rows) {
      const userId = row.user_id;
      if (!userMap.has(userId)) {
        userMap.set(userId, {
          user_id: userId,
          user_name: row.user_name,
          campaign_active: row.user_active !== false,
          country_name: row.country_name,
          country_code: row.country_code,
          days: { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null, 7: null },
          total_clientes: 0,
          total_efectivos: 0,
          total_menores: 0,
          days_with_entries: 0,
        });
      }

      const entry = userMap.get(userId)!;
      const dow = row.day_of_week; // 1=Monday, 7=Sunday
      entry.days[dow] = {
        clientes: parseInt(row.clientes),
        clientes_efectivos: parseInt(row.clientes_efectivos),
        menores: parseInt(row.menores),
        date: row.entry_date,
      };
      entry.total_clientes += parseInt(row.clientes);
      entry.total_efectivos += parseInt(row.clientes_efectivos);
      entry.total_menores += parseInt(row.menores);
      entry.days_with_entries++;
    }

    return {
      iso_year: isoYear,
      iso_week: isoWeek,
      week_start: weekDates[0],
      week_end: weekDates[6],
      rows: Array.from(userMap.values()),
    };
  }

  private getCurrentISOWeek(): number {
    const now = new Date();
    const jan4 = new Date(now.getFullYear(), 0, 4);
    const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000) + 1;
    return Math.ceil((dayOfYear + jan4.getDay() - 1) / 7);
  }

  private getISOWeekDates(isoYear: number, isoWeek: number): string[] {
    // Find Jan 4 of the ISO year (always in ISO week 1)
    const jan4 = new Date(Date.UTC(isoYear, 0, 4));
    // Find the Monday of ISO week 1
    const dow = jan4.getUTCDay() || 7; // convert Sunday=0 to 7
    const monday1 = new Date(jan4);
    monday1.setUTCDate(jan4.getUTCDate() - dow + 1);
    // Move to the target week
    const targetMonday = new Date(monday1);
    targetMonday.setUTCDate(monday1.getUTCDate() + (isoWeek - 1) * 7);

    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(targetMonday);
      d.setUTCDate(targetMonday.getUTCDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  }

  async getConsolidated(queryParams: any) {
    const { page, limit, offset } = parsePagination(queryParams);
    const { whereClause, params, paramIndex } = this.buildWhereClause(queryParams);

    const countResult = await query(
      `SELECT COUNT(*) FROM daily_entries de ${whereClause}`, params
    );
    const total = parseInt(countResult.rows[0].count);

    const dataParams = [...params, limit, offset];
    const result = await query(
      `SELECT de.id, de.entry_date, de.iso_year, de.iso_week,
              de.clientes, de.clientes_efectivos, de.menores,
              u.full_name as user_name,
              c.name as country_name, c.code as country_code,
              camp.name as campaign_name, camp.google_ads_campaign_id, camp.campaign_url,
              camp.customer_account_name,
              gas.conversions, gas.status as ads_status, gas.remaining_budget,
              gas.cost as ads_cost, gas.clicks, gas.impressions, gas.ctr
       FROM daily_entries de
       JOIN users u ON u.id = de.user_id
       JOIN countries c ON c.id = de.country_id
       LEFT JOIN campaigns camp ON camp.id = de.campaign_id
       LEFT JOIN google_ads_snapshots gas ON gas.campaign_id = de.campaign_id AND gas.snapshot_date = de.entry_date
       ${whereClause}
       ORDER BY de.entry_date DESC, u.full_name
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      dataParams
    );

    return { data: result.rows, meta: buildPaginationMeta(page, limit, total) };
  }

  async getCampaigns(queryParams: any) {
    const conditions: string[] = ['camp.is_active = TRUE'];
    const params: any[] = [];
    let paramIndex = 1;

    if (queryParams.country_id) {
      conditions.push(`camp.country_id = $${paramIndex++}`);
      params.push(parseInt(queryParams.country_id));
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const result = await query(
      `SELECT camp.*, c.name as country_name, c.code as country_code,
              u.full_name as assigned_user,
              (SELECT gas.status FROM google_ads_snapshots gas
               WHERE gas.campaign_id = camp.id ORDER BY gas.snapshot_date DESC LIMIT 1) as latest_status,
              (SELECT gas.conversions FROM google_ads_snapshots gas
               WHERE gas.campaign_id = camp.id ORDER BY gas.snapshot_date DESC LIMIT 1) as latest_conversions,
              (SELECT gas.remaining_budget FROM google_ads_snapshots gas
               WHERE gas.campaign_id = camp.id ORDER BY gas.snapshot_date DESC LIMIT 1) as latest_budget
       FROM campaigns camp
       JOIN countries c ON c.id = camp.country_id
       LEFT JOIN users u ON u.campaign_id = camp.id AND u.is_active = TRUE
       ${whereClause}
       ORDER BY camp.name`,
      params
    );

    return result.rows;
  }

  async getDashboardKpis(queryParams: any) {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (queryParams.country_id) {
      conditions.push(`de.country_id = $${paramIndex++}`);
      params.push(parseInt(queryParams.country_id));
    }
    if (queryParams.date_from) {
      conditions.push(`de.entry_date >= $${paramIndex++}`);
      params.push(queryParams.date_from);
    }
    if (queryParams.date_to) {
      conditions.push(`de.entry_date <= $${paramIndex++}`);
      params.push(queryParams.date_to);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const entryKpis = await query(
      `SELECT
        COUNT(*) as total_entries,
        COUNT(DISTINCT de.user_id) as users_reporting,
        COALESCE(SUM(de.clientes), 0) as total_clientes,
        COALESCE(SUM(de.clientes_efectivos), 0) as total_clientes_efectivos,
        COALESCE(SUM(de.menores), 0) as total_menores,
        CASE WHEN SUM(de.clientes) > 0
          THEN ROUND(SUM(de.clientes_efectivos)::numeric / SUM(de.clientes)::numeric, 4)
          ELSE 0 END as effectiveness_rate
       FROM daily_entries de
       ${whereClause}`,
      params
    );

    const adsConditions: string[] = [];
    const adsParams: any[] = [];
    if (queryParams.date_from) {
      adsParams.push(queryParams.date_from);
      adsConditions.push(`gas.snapshot_date >= $${adsParams.length}`);
    }
    if (queryParams.date_to) {
      adsParams.push(queryParams.date_to);
      adsConditions.push(`gas.snapshot_date <= $${adsParams.length}`);
    }
    const adsWhereClause = adsConditions.length > 0 ? `WHERE ${adsConditions.join(' AND ')}` : '';

    const adsKpis = await query(
      `SELECT
        COALESCE(SUM(gas.conversions), 0) as total_conversions,
        COALESCE(SUM(gas.cost), 0) as total_cost,
        COALESCE(SUM(gas.clicks), 0) as total_clicks,
        COALESCE(SUM(gas.impressions), 0) as total_impressions,
        COUNT(DISTINCT CASE WHEN gas.status = 'ENABLED' THEN gas.campaign_id END) as active_campaigns,
        COUNT(DISTINCT gas.campaign_id) as total_campaigns_with_data
       FROM google_ads_snapshots gas
       ${adsWhereClause}`,
      adsParams
    );

    const entry = entryKpis.rows[0];
    const ads = adsKpis.rows[0];

    return {
      totalEntries: parseInt(entry.total_entries),
      usersReporting: parseInt(entry.users_reporting),
      totalClientes: parseInt(entry.total_clientes),
      totalClientesEfectivos: parseInt(entry.total_clientes_efectivos),
      totalMenores: parseInt(entry.total_menores),
      effectivenessRate: parseFloat(entry.effectiveness_rate),
      totalConversions: parseFloat(ads.total_conversions),
      totalCost: parseFloat(ads.total_cost),
      totalClicks: parseInt(ads.total_clicks),
      totalImpressions: parseInt(ads.total_impressions),
      activeCampaigns: parseInt(ads.active_campaigns),
      conversionRate: parseInt(entry.total_clientes) > 0
        ? parseFloat(ads.total_conversions) / parseInt(entry.total_clientes)
        : 0,
      costPerConversion: parseFloat(ads.total_conversions) > 0
        ? parseFloat(ads.total_cost) / parseFloat(ads.total_conversions)
        : 0,
    };
  }

  async getDashboardCharts(queryParams: any) {
    const isoYear = queryParams.iso_year ? parseInt(queryParams.iso_year) : new Date().getFullYear();
    const isoWeek = queryParams.iso_week ? parseInt(queryParams.iso_week) : null;

    // Daily bar chart for current/selected week
    const dailyParams: any[] = [];
    let dailyCountryFilter = '';
    let dailyWeekFilter = '';
    if (queryParams.country_id) {
      dailyParams.push(parseInt(queryParams.country_id));
      dailyCountryFilter = `AND de.country_id = $${dailyParams.length}`;
    }
    if (isoWeek) {
      dailyParams.push(isoYear);
      dailyWeekFilter = `AND de.iso_year = $${dailyParams.length}`;
      dailyParams.push(isoWeek);
      dailyWeekFilter += ` AND de.iso_week = $${dailyParams.length}`;
    }

    const dailyData = await query(
      `SELECT de.entry_date,
              EXTRACT(ISODOW FROM de.entry_date) as day_of_week,
              SUM(de.clientes) as clientes,
              SUM(de.clientes_efectivos) as clientes_efectivos
       FROM daily_entries de
       WHERE 1=1 ${dailyCountryFilter} ${dailyWeekFilter}
       GROUP BY de.entry_date
       ORDER BY de.entry_date`,
      dailyParams
    );

    // Weekly line chart
    const weeklyParams: any[] = [isoYear];
    let weeklyCountryFilter = '';
    if (queryParams.country_id) {
      weeklyParams.push(parseInt(queryParams.country_id));
      weeklyCountryFilter = `AND de.country_id = $${weeklyParams.length}`;
    }

    const weeklyData = await query(
      `SELECT de.iso_year, de.iso_week,
              SUM(de.clientes) as clientes,
              SUM(de.clientes_efectivos) as clientes_efectivos
       FROM daily_entries de
       WHERE de.iso_year = $1 ${weeklyCountryFilter}
       GROUP BY de.iso_year, de.iso_week
       ORDER BY de.iso_week`,
      weeklyParams
    );

    // Country pie chart
    const countryParams: any[] = [isoYear];
    let countryWeekFilter = '';
    if (isoWeek) {
      countryParams.push(isoWeek);
      countryWeekFilter = `AND de.iso_week = $${countryParams.length}`;
    }

    const countryData = await query(
      `SELECT c.name, SUM(de.clientes) as total
       FROM daily_entries de
       JOIN countries c ON c.id = de.country_id
       WHERE de.iso_year = $1 ${countryWeekFilter}
       GROUP BY c.name
       ORDER BY total DESC`,
      countryParams
    );

    return {
      barChart: {
        labels: dailyData.rows.map(r => r.entry_date),
        datasets: [
          { label: 'Clientes', data: dailyData.rows.map(r => parseInt(r.clientes)) },
          { label: 'Clientes Efectivos', data: dailyData.rows.map(r => parseInt(r.clientes_efectivos)) },
        ],
      },
      lineChart: {
        labels: weeklyData.rows.map(r => `S${r.iso_week}`),
        datasets: [
          { label: 'Clientes Semanal', data: weeklyData.rows.map(r => parseInt(r.clientes)) },
          { label: 'Efectivos Semanal', data: weeklyData.rows.map(r => parseInt(r.clientes_efectivos)) },
        ],
      },
      pieChart: {
        labels: countryData.rows.map(r => r.name),
        datasets: [{ data: countryData.rows.map(r => parseInt(r.total)) }],
      },
    };
  }
}

export const pautadoresService = new PautadoresService();
