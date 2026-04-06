import { query } from '../../../config/database';
import { logAudit } from '../../../services/audit.service';
import { parsePagination, buildPaginationMeta } from '../../../utils/pagination.util';

export class CampaignsService {
  async list(queryParams: any) {
    const { page, limit, offset } = parsePagination(queryParams);
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (queryParams.country_id) {
      conditions.push(`c.country_id = $${paramIndex++}`);
      params.push(parseInt(queryParams.country_id));
    }
    if (queryParams.is_active !== undefined) {
      conditions.push(`c.is_active = $${paramIndex++}`);
      params.push(queryParams.is_active === 'true');
    }
    if (queryParams.search) {
      conditions.push(`(c.name ILIKE $${paramIndex} OR c.google_ads_campaign_id ILIKE $${paramIndex})`);
      params.push(`%${queryParams.search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query(
      `SELECT COUNT(*) FROM campaigns c ${whereClause}`, params
    );
    const total = parseInt(countResult.rows[0].count);

    const dataParams = [...params, limit, offset];
    const result = await query(
      `SELECT c.id, c.google_ads_campaign_id, c.name, c.country_id, c.campaign_url,
              c.is_active, c.created_at, co.name as country_name, co.code as country_code,
              (SELECT u.full_name FROM users u WHERE u.campaign_id = c.id AND u.is_active = TRUE LIMIT 1) as assigned_user
       FROM campaigns c
       JOIN countries co ON co.id = c.country_id
       ${whereClause}
       ORDER BY c.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      dataParams
    );

    return { data: result.rows, meta: buildPaginationMeta(page, limit, total) };
  }

  async getById(id: number) {
    const result = await query(
      `SELECT c.id, c.google_ads_campaign_id, c.name, c.country_id, c.campaign_url,
              c.is_active, c.created_at, c.updated_at,
              co.name as country_name, co.code as country_code
       FROM campaigns c
       JOIN countries co ON co.id = c.country_id
       WHERE c.id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      throw { status: 404, code: 'CAMPAIGN_NOT_FOUND', message: 'Campaña no encontrada' };
    }
    return result.rows[0];
  }

  async create(data: any, adminId: number, ip?: string) {
    const result = await query(
      `INSERT INTO campaigns (google_ads_campaign_id, name, country_id, campaign_url, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [data.google_ads_campaign_id || null, data.name, data.country_id, data.campaign_url || null, data.is_active !== false]
    );
    await logAudit(adminId, 'CAMPAIGN_CREATED', 'campaign', result.rows[0].id, { name: data.name }, ip);
    return result.rows[0];
  }

  async update(id: number, data: any, adminId: number, ip?: string) {
    const fields: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (data.name) { fields.push(`name = $${paramIndex++}`); params.push(data.name); }
    if (data.google_ads_campaign_id !== undefined) { fields.push(`google_ads_campaign_id = $${paramIndex++}`); params.push(data.google_ads_campaign_id || null); }
    if (data.country_id) { fields.push(`country_id = $${paramIndex++}`); params.push(data.country_id); }
    if (data.campaign_url !== undefined) { fields.push(`campaign_url = $${paramIndex++}`); params.push(data.campaign_url || null); }
    if (data.is_active !== undefined) { fields.push(`is_active = $${paramIndex++}`); params.push(data.is_active); }

    if (fields.length === 0) {
      throw { status: 400, code: 'NO_FIELDS', message: 'No hay campos para actualizar' };
    }

    fields.push('updated_at = NOW()');
    params.push(id);

    const result = await query(
      `UPDATE campaigns SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      throw { status: 404, code: 'CAMPAIGN_NOT_FOUND', message: 'Campaña no encontrada' };
    }

    await logAudit(adminId, 'CAMPAIGN_UPDATED', 'campaign', id, data, ip);
    return result.rows[0];
  }
}

export const campaignsService = new CampaignsService();
