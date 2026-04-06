import { query } from '../../../config/database';
import { logAudit } from '../../../services/audit.service';

export class CountriesService {
  async list(onlyActive = false) {
    const where = onlyActive ? 'WHERE is_active = TRUE' : '';
    const result = await query(
      `SELECT id, name, code, google_sheet_tab, timezone, is_active, created_at, updated_at
       FROM countries ${where} ORDER BY name`
    );
    return result.rows;
  }

  async getById(id: number) {
    const result = await query('SELECT * FROM countries WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      throw { status: 404, code: 'COUNTRY_NOT_FOUND', message: 'País no encontrado' };
    }
    return result.rows[0];
  }

  async create(data: any, adminId: number, ip?: string) {
    const result = await query(
      `INSERT INTO countries (name, code, google_sheet_tab, timezone, is_active)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.name, data.code, data.google_sheet_tab, data.timezone || 'America/Bogota', data.is_active !== false]
    );
    await logAudit(adminId, 'COUNTRY_CREATED', 'country', result.rows[0].id, { name: data.name }, ip);
    return result.rows[0];
  }

  async update(id: number, data: any, adminId: number, ip?: string) {
    const fields: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (data.name) { fields.push(`name = $${paramIndex++}`); params.push(data.name); }
    if (data.code) { fields.push(`code = $${paramIndex++}`); params.push(data.code); }
    if (data.google_sheet_tab) { fields.push(`google_sheet_tab = $${paramIndex++}`); params.push(data.google_sheet_tab); }
    if (data.timezone) { fields.push(`timezone = $${paramIndex++}`); params.push(data.timezone); }
    if (data.is_active !== undefined) { fields.push(`is_active = $${paramIndex++}`); params.push(data.is_active); }

    if (fields.length === 0) {
      throw { status: 400, code: 'NO_FIELDS', message: 'No hay campos para actualizar' };
    }

    fields.push('updated_at = NOW()');
    params.push(id);

    const result = await query(
      `UPDATE countries SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      throw { status: 404, code: 'COUNTRY_NOT_FOUND', message: 'País no encontrado' };
    }

    await logAudit(adminId, 'COUNTRY_UPDATED', 'country', id, data, ip);
    return result.rows[0];
  }
}

export const countriesService = new CountriesService();
