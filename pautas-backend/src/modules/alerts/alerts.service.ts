import { query } from '../../config/database';
import { logger } from '../../utils/logger.util';
import { parsePagination, buildPaginationMeta } from '../../utils/pagination.util';

export class AlertsService {

  // ─── Listar alertas con filtros ──────────────────────────

  async getAlerts(queryParams: any, userRole: string, userCountryId: number | null) {
    const { page, limit, offset } = parsePagination(queryParams);
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    // Filtro de acceso por rol
    if (userRole === 'gestion_administrativa' && userCountryId) {
      conditions.push(`a.country_id = $${paramIdx++}`);
      params.push(userCountryId);
    }

    // Filtros opcionales
    if (queryParams.severity) {
      conditions.push(`a.severity = $${paramIdx++}`);
      params.push(queryParams.severity);
    }
    if (queryParams.status) {
      conditions.push(`a.status = $${paramIdx++}`);
      params.push(queryParams.status);
    }
    if (queryParams.country_id) {
      conditions.push(`a.country_id = $${paramIdx++}`);
      params.push(parseInt(queryParams.country_id));
    }
    if (queryParams.campaign_id) {
      conditions.push(`a.campaign_id = $${paramIdx++}`);
      params.push(parseInt(queryParams.campaign_id));
    }
    if (queryParams.alert_type) {
      conditions.push(`a.alert_type = $${paramIdx++}`);
      params.push(queryParams.alert_type);
    }
    if (queryParams.date_from) {
      conditions.push(`a.created_at >= $${paramIdx++}`);
      params.push(queryParams.date_from);
    }
    if (queryParams.date_to) {
      conditions.push(`a.created_at <= ($${paramIdx++}::date + INTERVAL '1 day')`);
      params.push(queryParams.date_to);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const countResult = await query(
      `SELECT COUNT(*) FROM alerts a ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const dataResult = await query(`
      SELECT
        a.*,
        u.full_name AS user_full_name,
        u.username AS user_username,
        c.name AS country_name,
        c.code AS country_code,
        camp.name AS campaign_name,
        ack_u.full_name AS acknowledged_by_name,
        res_u.full_name AS resolved_by_name,
        dis_u.full_name AS dismissed_by_name
      FROM alerts a
      LEFT JOIN users u ON u.id = a.user_id
      LEFT JOIN countries c ON c.id = a.country_id
      LEFT JOIN campaigns camp ON camp.id = a.campaign_id
      LEFT JOIN users ack_u ON ack_u.id = a.acknowledged_by
      LEFT JOIN users res_u ON res_u.id = a.resolved_by
      LEFT JOIN users dis_u ON dis_u.id = a.dismissed_by
      ${whereClause}
      ORDER BY
        CASE a.severity WHEN 'CRITICAL' THEN 1 WHEN 'WARNING' THEN 2 ELSE 3 END,
        a.created_at DESC
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `, [...params, limit, offset]);

    return { data: dataResult.rows, meta: buildPaginationMeta(page, limit, total) };
  }

  // ─── Resumen de conteos por severidad ──────────────────────

  async getSummary(userRole: string, userCountryId: number | null) {
    let countryFilter = '';
    const params: any[] = [];

    if (userRole === 'gestion_administrativa' && userCountryId) {
      countryFilter = 'AND country_id = $1';
      params.push(userCountryId);
    }

    const result = await query(`
      SELECT
        severity,
        COUNT(*) FILTER (WHERE status = 'ACTIVE') AS active_count,
        COUNT(*) AS total_count
      FROM alerts
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days' ${countryFilter}
      GROUP BY severity
    `, params);

    const summary = {
      critical: { active: 0, total: 0 },
      warning: { active: 0, total: 0 },
      info: { active: 0, total: 0 },
    };

    for (const row of result.rows) {
      const key = row.severity.toLowerCase() as keyof typeof summary;
      if (summary[key]) {
        summary[key] = {
          active: parseInt(row.active_count),
          total: parseInt(row.total_count),
        };
      }
    }

    return summary;
  }

  // ─── Tendencia de alertas por día (última semana) ──────────

  async getTrend(userRole: string, userCountryId: number | null) {
    let countryFilter = '';
    const params: any[] = [];

    if (userRole === 'gestion_administrativa' && userCountryId) {
      countryFilter = 'AND a.country_id = $1';
      params.push(userCountryId);
    }

    const result = await query(`
      SELECT
        a.created_at::date AS date,
        a.severity,
        COUNT(*) AS count
      FROM alerts a
      WHERE a.created_at >= CURRENT_DATE - INTERVAL '7 days' ${countryFilter}
      GROUP BY a.created_at::date, a.severity
      ORDER BY date
    `, params);

    return result.rows;
  }

  // ─── Top conglomerados más alertados ───────────────────────

  async getTopAlerted(userRole: string, userCountryId: number | null, limitNum = 10) {
    let countryFilter = '';
    const params: any[] = [];
    let paramIdx = 1;

    if (userRole === 'gestion_administrativa' && userCountryId) {
      countryFilter = `AND a.country_id = $${paramIdx++}`;
      params.push(userCountryId);
    }

    const result = await query(`
      SELECT
        a.user_id,
        u.full_name,
        u.username,
        c.name AS country_name,
        COUNT(*) AS total_alerts,
        COUNT(*) FILTER (WHERE a.severity = 'CRITICAL') AS critical_count,
        COUNT(*) FILTER (WHERE a.severity = 'WARNING') AS warning_count,
        COUNT(*) FILTER (WHERE a.severity = 'INFO') AS info_count
      FROM alerts a
      JOIN users u ON u.id = a.user_id
      LEFT JOIN countries c ON c.id = a.country_id
      WHERE a.created_at >= CURRENT_DATE - INTERVAL '30 days' ${countryFilter}
        AND a.user_id IS NOT NULL
      GROUP BY a.user_id, u.full_name, u.username, c.name
      ORDER BY total_alerts DESC
      LIMIT $${paramIdx++}
    `, [...params, limitNum]);

    return result.rows;
  }

  // ─── Acknowledge ──────────────────────────────────────────

  async acknowledge(alertId: number, userId: number) {
    const result = await query(`
      UPDATE alerts
      SET status = 'ACKNOWLEDGED', acknowledged_by = $2, acknowledged_at = NOW()
      WHERE id = $1 AND status = 'ACTIVE'
      RETURNING *
    `, [alertId, userId]);

    if (result.rows.length === 0) {
      throw { status: 404, code: 'ALERT_NOT_FOUND', message: 'Alerta no encontrada o no está activa' };
    }
    return result.rows[0];
  }

  // ─── Resolve ──────────────────────────────────────────────

  async resolve(alertId: number, userId: number) {
    const result = await query(`
      UPDATE alerts
      SET status = 'RESOLVED', resolved_by = $2, resolved_at = NOW()
      WHERE id = $1 AND status IN ('ACTIVE', 'ACKNOWLEDGED')
      RETURNING *
    `, [alertId, userId]);

    if (result.rows.length === 0) {
      throw { status: 404, code: 'ALERT_NOT_FOUND', message: 'Alerta no encontrada o ya fue resuelta' };
    }
    return result.rows[0];
  }

  // ─── Dismiss ──────────────────────────────────────────────

  async dismiss(alertId: number, userId: number) {
    const result = await query(`
      UPDATE alerts
      SET status = 'DISMISSED', dismissed_by = $2, dismissed_at = NOW()
      WHERE id = $1 AND status IN ('ACTIVE', 'ACKNOWLEDGED')
      RETURNING *
    `, [alertId, userId]);

    if (result.rows.length === 0) {
      throw { status: 404, code: 'ALERT_NOT_FOUND', message: 'Alerta no encontrada o ya fue descartada' };
    }
    return result.rows[0];
  }

  // ─── Thresholds CRUD ──────────────────────────────────────

  async getThresholds() {
    const result = await query(`
      SELECT at.*,
        c.name AS country_name,
        camp.name AS campaign_name,
        u.full_name AS updated_by_name
      FROM alert_thresholds at
      LEFT JOIN countries c ON c.id = at.country_id
      LEFT JOIN campaigns camp ON camp.id = at.campaign_id
      LEFT JOIN users u ON u.id = at.updated_by
      ORDER BY at.alert_type, at.country_id NULLS FIRST
    `);
    return result.rows;
  }

  async upsertThreshold(data: {
    alert_type: string;
    country_id: number | null;
    campaign_id: number | null;
    threshold_value: number;
    is_active: boolean;
    updated_by: number;
  }) {
    const result = await query(`
      INSERT INTO alert_thresholds (alert_type, country_id, campaign_id, threshold_value, is_active, updated_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (alert_type, country_id, campaign_id)
      DO UPDATE SET
        threshold_value = EXCLUDED.threshold_value,
        is_active = EXCLUDED.is_active,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
      RETURNING *
    `, [data.alert_type, data.country_id, data.campaign_id, data.threshold_value, data.is_active, data.updated_by]);

    return result.rows[0];
  }

  // ─── Ranking de conglomerados ─────────────────────────────

  async getRanking(queryParams: any) {
    let conditions: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (queryParams.country_id) {
      conditions.push(`country_id = $${paramIdx++}`);
      params.push(parseInt(queryParams.country_id));
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await query(`
      SELECT *
      FROM v_conglomerate_ranking
      ${whereClause}
      ORDER BY rank_in_country, conversion_rate DESC
    `, params);

    return result.rows;
  }

  // ─── Cruce Ads vs Campo ───────────────────────────────────

  async getAdsVsFieldComparison(queryParams: any) {
    let dateFilter = "AND gas.snapshot_date >= CURRENT_DATE - INTERVAL '30 days' AND de.entry_date >= CURRENT_DATE - INTERVAL '30 days'";
    const params: any[] = [];
    let paramIdx = 1;

    if (queryParams.date_from && queryParams.date_to) {
      dateFilter = `AND gas.snapshot_date >= $${paramIdx} AND gas.snapshot_date <= $${paramIdx + 1} AND de.entry_date >= $${paramIdx} AND de.entry_date <= $${paramIdx + 1}`;
      params.push(queryParams.date_from, queryParams.date_to);
      paramIdx += 2;
    }

    let countryFilter = '';
    if (queryParams.country_id) {
      countryFilter = `AND c.country_id = $${paramIdx++}`;
      params.push(parseInt(queryParams.country_id));
    }

    const result = await query(`
      SELECT
        c.id AS campaign_id,
        c.name AS campaign_name,
        co.name AS country_name,
        co.code AS country_code,
        COALESCE(ads.total_conversions, 0) AS ads_conversions,
        COALESCE(field.total_efectivos, 0) AS field_efectivos,
        COALESCE(ads.total_cost, 0) AS total_cost,
        CASE WHEN COALESCE(field.total_efectivos, 0) > 0
          THEN ROUND(COALESCE(ads.total_cost, 0)::numeric / field.total_efectivos, 2)
          ELSE 0
        END AS cost_per_real_client,
        CASE WHEN GREATEST(COALESCE(ads.total_conversions, 0), COALESCE(field.total_efectivos, 0)) > 0
          THEN ROUND(
            ABS(COALESCE(ads.total_conversions, 0) - COALESCE(field.total_efectivos, 0))::numeric /
            GREATEST(COALESCE(ads.total_conversions, 0), COALESCE(field.total_efectivos, 0)) * 100, 2
          )
          ELSE 0
        END AS discrepancy_pct
      FROM campaigns c
      JOIN countries co ON co.id = c.country_id
      LEFT JOIN (
        SELECT campaign_id, SUM(conversions) AS total_conversions, SUM(cost) AS total_cost
        FROM google_ads_snapshots gas
        WHERE 1=1 ${dateFilter.includes('gas.') ? dateFilter.split('AND de.')[0] : ''}
        GROUP BY campaign_id
      ) ads ON ads.campaign_id = c.id
      LEFT JOIN (
        SELECT campaign_id, SUM(clientes_efectivos) AS total_efectivos
        FROM daily_entries de
        WHERE 1=1 ${dateFilter.includes('de.') ? 'AND de.entry_date >= CURRENT_DATE - INTERVAL \'30 days\'' : ''}
        GROUP BY campaign_id
      ) field ON field.campaign_id = c.id
      WHERE c.is_active = TRUE ${countryFilter}
      ORDER BY discrepancy_pct DESC
    `, params);

    return result.rows;
  }
}

export const alertsService = new AlertsService();
