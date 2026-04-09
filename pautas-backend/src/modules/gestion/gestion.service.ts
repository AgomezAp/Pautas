import path from 'path';
import { query } from '../../config/database';
import bcrypt from 'bcryptjs';
import { logAudit } from '../../services/audit.service';
import { toRelativeImagePath } from '../../utils/image-path.util';
import { cacheService } from '../../services/cache.service';
import { imageCleanupService } from '../../services/image-cleanup.service';
import { env } from '../../config/environment';

function buildParamsKey(params: any): string {
  return Object.keys(params || {}).sort().map(k => `${k}=${params[k] ?? ''}`).join(':') || 'all';
}

export class GestionService {
  async getDashboardKpis(queryParams: any) {
    const CACHE_KEY = `gestion:kpis:${buildParamsKey(queryParams)}`;
    const cached = await cacheService.get(CACHE_KEY);
    if (cached) return cached;

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

    await cacheService.set(CACHE_KEY, result.rows[0], 180);
    return result.rows[0];
  }

  async getEffectivenessReport(queryParams: any) {
    const CACHE_KEY = `gestion:effectiveness:${buildParamsKey(queryParams)}`;
    const cached = await cacheService.get(CACHE_KEY);
    if (cached) return cached;

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

    await cacheService.set(CACHE_KEY, result.rows, 180);
    return result.rows;
  }

  async getConversionReport(queryParams: any) {
    const CACHE_KEY = `gestion:conversions:${buildParamsKey(queryParams)}`;
    const cached = await cacheService.get(CACHE_KEY);
    if (cached) return cached;

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

    await cacheService.set(CACHE_KEY, result.rows, 180);
    return result.rows;
  }

  async getByCountryReport() {
    const CACHE_KEY = 'gestion:by-country';
    const cached = await cacheService.get(CACHE_KEY);
    if (cached) return cached;

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

    await cacheService.set(CACHE_KEY, result.rows, 300);
    return result.rows;
  }

  async getByWeekReport(queryParams: any) {
    const CACHE_KEY = `gestion:by-week:${buildParamsKey(queryParams)}`;
    const cached = await cacheService.get(CACHE_KEY);
    if (cached) return cached;

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

    await cacheService.set(CACHE_KEY, result.rows, 300);
    return result.rows;
  }

  async getConglomeradoUsers(countryId?: number) {
    const CACHE_KEY = `gestion:cong-users:${countryId || 'all'}`;
    const cached = await cacheService.get(CACHE_KEY);
    if (cached) return cached;

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
    await cacheService.set(CACHE_KEY, result.rows, 180);
    return result.rows;
  }

  async updateGoogleAdsAccount(userId: number, googleAdsAccountId: string | null) {
    await query(
      'UPDATE users SET google_ads_account_id = $1, updated_at = NOW() WHERE id = $2',
      [googleAdsAccountId, userId]
    );
    await cacheService.invalidatePattern('gestion:cong-users:*');
  }

  async createConglomeradoUser(data: {
    username: string;
    full_name: string;
    email?: string;
    password?: string;
    country_id: number;
    campaign_id?: number;
  }, createdByUserId: number, ip?: string) {
    // Obtener el role_id de conglomerado
    const roleResult = await query("SELECT id FROM roles WHERE name = 'conglomerado'");
    if (roleResult.rows.length === 0) {
      throw { status: 500, code: 'ROLE_NOT_FOUND', message: 'Rol conglomerado no encontrado' };
    }
    const roleId = roleResult.rows[0].id;

    const passwordHash = await bcrypt.hash(data.password || 'Temp1234', 12);

    const result = await query(
      `INSERT INTO users (username, email, password_hash, full_name, role_id, country_id, campaign_id, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
       RETURNING id, username, email, full_name, role_id, country_id, campaign_id, is_active, created_at`,
      [
        data.username,
        data.email || null,
        passwordHash,
        data.full_name,
        roleId,
        data.country_id,
        data.campaign_id || null,
      ]
    );

    await logAudit(createdByUserId, 'CONGLOMERADO_USER_CREATED', 'user', result.rows[0].id, { username: data.username, created_by_role: 'gestion_administrativa' }, ip);
    await cacheService.invalidatePattern('admin:stats');
    await cacheService.invalidatePattern('gestion:cong-users:*');
    return result.rows[0];
  }

  async getEntriesWithImages(queryParams: any) {
    const CACHE_KEY = `gestion:soporte-images:${buildParamsKey(queryParams)}`;
    const cached = await cacheService.get<{ data: any[] }>(CACHE_KEY);
    if (cached) return cached;

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
    if (queryParams.search) {
      conditions.push(`(u.full_name ILIKE $${paramIndex} OR u.username ILIKE $${paramIndex})`);
      params.push(`%${queryParams.search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // Get entries that have images (either in entry_images table or legacy soporte_image_path)
    const result = await query(
      `SELECT de.id as entry_id, de.entry_date, de.clientes, de.clientes_efectivos, de.menores,
              de.user_id, u.full_name, u.username,
              c.name as country_name,
              ei.id as image_id, ei.image_path, ei.original_name, ei.thumb_path
       FROM daily_entries de
       JOIN users u ON u.id = de.user_id
       JOIN countries c ON c.id = de.country_id
       JOIN entry_images ei ON ei.entry_id = de.id
       ${whereClause}
       ORDER BY u.full_name, de.entry_date DESC, ei.id`,
      params
    );

    // Group by user -> entries -> images
    const usersMap = new Map<number, any>();
    for (const row of result.rows) {
      if (!usersMap.has(row.user_id)) {
        usersMap.set(row.user_id, {
          user_id: row.user_id,
          full_name: row.full_name,
          username: row.username,
          country_name: row.country_name,
          total_images: 0,
          entries: new Map<number, any>(),
        });
      }
      const user = usersMap.get(row.user_id)!;

      if (!user.entries.has(row.entry_id)) {
        user.entries.set(row.entry_id, {
          entry_id: row.entry_id,
          entry_date: row.entry_date,
          clientes: row.clientes,
          clientes_efectivos: row.clientes_efectivos,
          menores: row.menores,
          images: [],
        });
      }
      const entry = user.entries.get(row.entry_id)!;
      entry.images.push({
        id: row.image_id,
        image_path: toRelativeImagePath(row.image_path),
        original_name: row.original_name,
        thumb_path: row.thumb_path ? toRelativeImagePath(row.thumb_path) : null,
      });
      user.total_images++;
    }

    // Convert Maps to arrays
    const data = Array.from(usersMap.values()).map(user => ({
      ...user,
      entries: Array.from(user.entries.values()),
    }));

    const responseData = { data };
    await cacheService.set(CACHE_KEY, responseData, 120);
    return responseData;
  }

  async resetEntry(entryId: number, resetByUserId: number, ip?: string) {
    // 1. Fetch entry data before deletion (for audit)
    const entryResult = await query(
      `SELECT de.*, u.full_name, u.username
       FROM daily_entries de
       JOIN users u ON u.id = de.user_id
       WHERE de.id = $1`,
      [entryId]
    );

    if (entryResult.rows.length === 0) {
      throw { status: 404, code: 'ENTRY_NOT_FOUND', message: 'Entrada no encontrada' };
    }

    const entry = entryResult.rows[0];

    // 2. Fetch associated images for filesystem cleanup
    const imagesResult = await query(
      'SELECT id, image_path, thumb_path FROM entry_images WHERE entry_id = $1',
      [entryId]
    );

    // 3. Delete image files from filesystem
    const uploadBase = path.resolve(env.upload.dir);
    for (const img of imagesResult.rows) {
      if (img.image_path) {
        const filePath = imageCleanupService.resolveFilePath(uploadBase, img.image_path);
        imageCleanupService.deleteFile(filePath);
      }
      if (img.thumb_path) {
        const thumbPath = imageCleanupService.resolveFilePath(uploadBase, img.thumb_path);
        imageCleanupService.deleteFile(thumbPath);
      }
    }

    // 4. Hard DELETE (entry_images cascade-deleted)
    await query('DELETE FROM daily_entries WHERE id = $1', [entryId]);

    // 5. Audit log with previous data
    await logAudit(resetByUserId, 'ENTRY_RESET', 'daily_entry', entryId, {
      previous_data: {
        entry_date: entry.entry_date,
        user_id: entry.user_id,
        user_name: entry.full_name,
        username: entry.username,
        clientes: entry.clientes,
        clientes_efectivos: entry.clientes_efectivos,
        menores: entry.menores,
        country_id: entry.country_id,
        campaign_id: entry.campaign_id,
      },
      images_deleted: imagesResult.rows.length,
    }, ip);

    // 6. Invalidate caches
    await Promise.all([
      cacheService.invalidatePattern('admin:stats'),
      cacheService.invalidatePattern('admin:conglomerado-entries:*'),
      cacheService.invalidatePattern('gestion:*'),
      cacheService.invalidatePattern(`cong:*:${entry.user_id}:*`),
    ]);

    return { id: entryId, deleted: true };
  }

  async resetPassword(userId: number, newPassword: string, resetByUserId: number, ip?: string) {
    // Verify the user exists and is a conglomerado user
    const userResult = await query(
      `SELECT u.id, u.full_name, u.username, r.name as role_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw { status: 404, code: 'USER_NOT_FOUND', message: 'Usuario no encontrado' };
    }

    const user = userResult.rows[0];
    if (user.role_name !== 'conglomerado') {
      throw { status: 403, code: 'INVALID_ROLE', message: 'Solo se puede resetear la contraseña de usuarios del conglomerado' };
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, userId]
    );

    await logAudit(resetByUserId, 'PASSWORD_RESET', 'user', userId, {
      target_user: user.username,
      target_name: user.full_name,
    }, ip);

    return { id: userId, username: user.username, passwordReset: true };
  }
}

export const gestionService = new GestionService();
