import { query } from '../../config/database';

export class GestionService {
  async getDashboardKpis(queryParams: any) {
    const params: any[] = [];
    let countryFilter = '';
    let dateFrom = '';
    let dateTo = '';
    if (queryParams.country_id) {
      params.push(parseInt(queryParams.country_id));
      countryFilter = `AND de.country_id = $${params.length}`;
    }
    if (queryParams.date_from) {
      params.push(queryParams.date_from);
      dateFrom = `AND de.entry_date >= $${params.length}`;
    }
    if (queryParams.date_to) {
      params.push(queryParams.date_to);
      dateTo = `AND de.entry_date <= $${params.length}`;
    }

    const result = await query(
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
       WHERE 1=1 ${countryFilter} ${dateFrom} ${dateTo}`,
      params
    );

    return result.rows[0];
  }

  async getEffectivenessReport(queryParams: any) {
    const params: any[] = [];
    let countryFilter = '';
    if (queryParams.country_id) {
      params.push(parseInt(queryParams.country_id));
      countryFilter = `AND de.country_id = $${params.length}`;
    }

    const result = await query(
      `SELECT camp.name as campaign_name, c.name as country_name,
              u.full_name as user_name,
              SUM(de.clientes) as total_clientes,
              SUM(de.clientes_efectivos) as total_clientes_efectivos,
              CASE WHEN SUM(de.clientes) > 0
                THEN ROUND(SUM(de.clientes_efectivos)::numeric / SUM(de.clientes)::numeric, 4)
                ELSE 0 END as effectiveness_rate
       FROM daily_entries de
       JOIN users u ON u.id = de.user_id
       JOIN countries c ON c.id = de.country_id
       LEFT JOIN campaigns camp ON camp.id = de.campaign_id
       WHERE 1=1 ${countryFilter}
       GROUP BY camp.name, c.name, u.full_name
       ORDER BY effectiveness_rate DESC`,
      params
    );

    return result.rows;
  }

  async getConversionReport(queryParams: any) {
    const params: any[] = [];
    let countryFilter = '';
    if (queryParams.country_id) {
      params.push(parseInt(queryParams.country_id));
      countryFilter = `AND de.country_id = $${params.length}`;
    }

    const result = await query(
      `SELECT camp.name as campaign_name, c.name as country_name,
              SUM(de.clientes) as total_clientes,
              COALESCE(SUM(gas.conversions), 0) as total_conversions,
              CASE WHEN SUM(de.clientes) > 0
                THEN ROUND(COALESCE(SUM(gas.conversions), 0)::numeric / SUM(de.clientes)::numeric, 4)
                ELSE 0 END as conversion_rate,
              COALESCE(SUM(gas.cost), 0) as total_cost
       FROM daily_entries de
       JOIN countries c ON c.id = de.country_id
       LEFT JOIN campaigns camp ON camp.id = de.campaign_id
       LEFT JOIN google_ads_snapshots gas ON gas.campaign_id = de.campaign_id AND gas.snapshot_date = de.entry_date
       WHERE 1=1 ${countryFilter}
       GROUP BY camp.name, c.name
       ORDER BY conversion_rate DESC`,
      params
    );

    return result.rows;
  }

  async getByCountryReport() {
    const result = await query(
      `SELECT c.name as country_name, c.code as country_code,
              COUNT(DISTINCT de.user_id) as total_users,
              COUNT(*) as total_entries,
              SUM(de.clientes) as total_clientes,
              SUM(de.clientes_efectivos) as total_clientes_efectivos,
              SUM(de.menores) as total_menores,
              CASE WHEN SUM(de.clientes) > 0
                THEN ROUND(SUM(de.clientes_efectivos)::numeric / SUM(de.clientes)::numeric, 4)
                ELSE 0 END as effectiveness_rate
       FROM daily_entries de
       JOIN countries c ON c.id = de.country_id
       GROUP BY c.name, c.code
       ORDER BY total_clientes DESC`
    );

    return result.rows;
  }

  async getByWeekReport(queryParams: any) {
    const params: any[] = [];
    let countryFilter = '';
    let yearFilter = '';
    if (queryParams.country_id) {
      params.push(parseInt(queryParams.country_id));
      countryFilter = `AND de.country_id = $${params.length}`;
    }
    if (queryParams.iso_year) {
      params.push(parseInt(queryParams.iso_year));
      yearFilter = `AND de.iso_year = $${params.length}`;
    }

    const result = await query(
      `SELECT de.iso_year, de.iso_week,
              COUNT(DISTINCT de.user_id) as users_reporting,
              SUM(de.clientes) as total_clientes,
              SUM(de.clientes_efectivos) as total_clientes_efectivos,
              SUM(de.menores) as total_menores,
              CASE WHEN SUM(de.clientes) > 0
                THEN ROUND(SUM(de.clientes_efectivos)::numeric / SUM(de.clientes)::numeric, 4)
                ELSE 0 END as effectiveness_rate
       FROM daily_entries de
       WHERE 1=1 ${countryFilter} ${yearFilter}
       GROUP BY de.iso_year, de.iso_week
       ORDER BY de.iso_year DESC, de.iso_week DESC`,
      params
    );

    return result.rows;
  }

  async getConglomeradoUsers(countryId?: number) {
    const params: any[] = [];
    let countryFilter = '';
    if (countryId) {
      params.push(countryId);
      countryFilter = `AND u.country_id = $${params.length}`;
    }
    const result = await query(
      `SELECT u.id, u.full_name, u.username, u.email, u.google_ads_account_id, u.is_active,
              c.name as country_name, c.code as country_code,
              camp.name as campaign_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN countries c ON c.id = u.country_id
       LEFT JOIN campaigns camp ON camp.id = u.campaign_id
       WHERE r.name = 'conglomerado' ${countryFilter}
       ORDER BY u.full_name`,
      params
    );
    return result.rows;
  }

  async updateGoogleAdsAccount(userId: number, googleAdsAccountId: string | null) {
    await query(
      'UPDATE users SET google_ads_account_id = $1, updated_at = NOW() WHERE id = $2',
      [googleAdsAccountId, userId]
    );
  }

  async getEntriesWithImages(queryParams: any) {
    const { parsePagination, buildPaginationMeta } = require('../../utils/pagination.util');
    const { page, limit, offset } = parsePagination(queryParams);

    const conditions: string[] = ['de.soporte_image_path IS NOT NULL'];
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
    if (queryParams.search) {
      conditions.push(`(u.full_name ILIKE $${paramIndex} OR u.username ILIKE $${paramIndex})`);
      params.push(`%${queryParams.search}%`);
      paramIndex++;
    }

    const whereClause = 'WHERE ' + conditions.join(' AND ');

    const countResult = await query(
      `SELECT COUNT(*) FROM daily_entries de JOIN users u ON u.id = de.user_id ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const dataParams = [...params, limit, offset];
    const result = await query(
      `SELECT de.id, de.entry_date, de.clientes, de.clientes_efectivos, de.menores,
              de.soporte_image_path, de.soporte_original_name, de.created_at,
              u.full_name, u.username,
              c.name as country_name
       FROM daily_entries de
       JOIN users u ON u.id = de.user_id
       JOIN countries c ON c.id = de.country_id
       ${whereClause}
       ORDER BY de.entry_date DESC, u.full_name
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      dataParams
    );

    return { data: result.rows, meta: buildPaginationMeta(page, limit, total) };
  }
}

export const gestionService = new GestionService();
