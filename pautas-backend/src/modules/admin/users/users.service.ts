import bcrypt from 'bcryptjs';
import { query } from '../../../config/database';
import { logAudit } from '../../../services/audit.service';
import { parsePagination, buildPaginationMeta } from '../../../utils/pagination.util';

export class UsersService {
  async list(queryParams: any) {
    const { page, limit, offset } = parsePagination(queryParams);
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (queryParams.role) {
      conditions.push(`r.name = $${paramIndex++}`);
      params.push(queryParams.role);
    }
    if (queryParams.country_id) {
      conditions.push(`u.country_id = $${paramIndex++}`);
      params.push(parseInt(queryParams.country_id));
    }
    if (queryParams.is_active !== undefined) {
      conditions.push(`u.is_active = $${paramIndex++}`);
      params.push(queryParams.is_active === 'true');
    }
    if (queryParams.search) {
      conditions.push(`(u.username ILIKE $${paramIndex} OR u.full_name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`);
      params.push(`%${queryParams.search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query(
      `SELECT COUNT(*) FROM users u JOIN roles r ON r.id = u.role_id ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const dataParams = [...params, limit, offset];
    const result = await query(
      `SELECT u.id, u.username, u.email, u.full_name, u.is_active, u.last_login_at,
              u.created_at, u.country_id, u.campaign_id,
              r.name as role, c.name as country_name, camp.name as campaign_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN countries c ON c.id = u.country_id
       LEFT JOIN campaigns camp ON camp.id = u.campaign_id
       ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      dataParams
    );

    return { data: result.rows, meta: buildPaginationMeta(page, limit, total) };
  }

  async getById(id: number) {
    const result = await query(
      `SELECT u.id, u.username, u.email, u.full_name, u.is_active, u.last_login_at,
              u.created_at, u.country_id, u.campaign_id,
              r.name as role, r.id as role_id, c.name as country_name, camp.name as campaign_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN countries c ON c.id = u.country_id
       LEFT JOIN campaigns camp ON camp.id = u.campaign_id
       WHERE u.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw { status: 404, code: 'USER_NOT_FOUND', message: 'Usuario no encontrado' };
    }
    return result.rows[0];
  }

  async create(data: any, adminId: number, ip?: string) {
    const passwordHash = await bcrypt.hash(data.password || 'Temp1234', 12);

    const result = await query(
      `INSERT INTO users (username, email, password_hash, full_name, role_id, country_id, campaign_id, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, username, email, full_name, role_id, country_id, campaign_id, is_active, created_at`,
      [
        data.username,
        data.email || null,
        passwordHash,
        data.full_name,
        data.role_id,
        data.country_id || null,
        data.campaign_id || null,
        data.is_active !== undefined ? data.is_active : true,
      ]
    );

    await logAudit(adminId, 'USER_CREATED', 'user', result.rows[0].id, { username: data.username }, ip);
    return result.rows[0];
  }

  async update(id: number, data: any, adminId: number, ip?: string) {
    const fields: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (data.email !== undefined) { fields.push(`email = $${paramIndex++}`); params.push(data.email); }
    if (data.full_name) { fields.push(`full_name = $${paramIndex++}`); params.push(data.full_name); }
    if (data.role_id) { fields.push(`role_id = $${paramIndex++}`); params.push(data.role_id); }
    if (data.country_id !== undefined) { fields.push(`country_id = $${paramIndex++}`); params.push(data.country_id || null); }
    if (data.campaign_id !== undefined) { fields.push(`campaign_id = $${paramIndex++}`); params.push(data.campaign_id || null); }
    if (data.is_active !== undefined) { fields.push(`is_active = $${paramIndex++}`); params.push(data.is_active); }
    if (data.password) {
      const hash = await bcrypt.hash(data.password, 12);
      fields.push(`password_hash = $${paramIndex++}`);
      params.push(hash);
    }

    fields.push('updated_at = NOW()');
    params.push(id);

    const result = await query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING id`,
      params
    );

    if (result.rows.length === 0) {
      throw { status: 404, code: 'USER_NOT_FOUND', message: 'Usuario no encontrado' };
    }

    await logAudit(adminId, 'USER_UPDATED', 'user', id, data, ip);
    return this.getById(id);
  }

  async toggleActive(id: number, adminId: number, ip?: string) {
    const result = await query(
      'UPDATE users SET is_active = NOT is_active, updated_at = NOW() WHERE id = $1 RETURNING id, is_active',
      [id]
    );

    if (result.rows.length === 0) {
      throw { status: 404, code: 'USER_NOT_FOUND', message: 'Usuario no encontrado' };
    }

    // Revoke all refresh tokens when deactivating a user
    if (!result.rows[0].is_active) {
      await query('UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1', [id]);
    }

    await logAudit(adminId, 'USER_TOGGLED', 'user', id, { is_active: result.rows[0].is_active }, ip);
    return result.rows[0];
  }

  async softDelete(id: number, adminId: number, ip?: string) {
    const result = await query(
      'UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      throw { status: 404, code: 'USER_NOT_FOUND', message: 'Usuario no encontrado' };
    }

    await logAudit(adminId, 'USER_DELETED', 'user', id, null, ip);
    return { id, deleted: true };
  }

  async getPautadorAccounts(userId: number): Promise<string[]> {
    const result = await query(
      'SELECT google_ads_account_id FROM user_google_ads_accounts WHERE user_id = $1 ORDER BY assigned_at',
      [userId]
    );
    return result.rows.map((r: any) => r.google_ads_account_id);
  }

  async setPautadorAccounts(userId: number, accountIds: string[]): Promise<void> {
    await query('DELETE FROM user_google_ads_accounts WHERE user_id = $1', [userId]);
    if (accountIds.length > 0) {
      const values = accountIds.map((id, i) => `($1, $${i + 2})`).join(', ');
      await query(
        `INSERT INTO user_google_ads_accounts (user_id, google_ads_account_id) VALUES ${values}`,
        [userId, ...accountIds]
      );
    }
  }

  async getAllGoogleAdsAccounts(): Promise<any[]> {
    const result = await query(
      `SELECT DISTINCT c.customer_account_id, c.customer_account_name
       FROM campaigns c
       WHERE c.customer_account_id IS NOT NULL AND c.is_active = TRUE
       ORDER BY c.customer_account_name`
    );
    return result.rows;
  }
}

export const usersService = new UsersService();
