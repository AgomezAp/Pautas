import { query, getClient } from '../../config/database';
import { logAudit } from '../../services/audit.service';
import { getISOWeekInfo } from '../../utils/iso-week.util';
import { parsePagination, buildPaginationMeta } from '../../utils/pagination.util';

export class ConglomeradoService {
  async checkTodayEntry(userId: number) {
    const today = new Date().toISOString().split('T')[0];
    const result = await query(
      'SELECT id, entry_date FROM daily_entries WHERE user_id = $1 AND entry_date = $2',
      [userId, today]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async createEntry(
    userId: number,
    countryId: number,
    campaignId: number | null,
    data: { clientes: number; clientes_efectivos: number; menores: number },
    images: { imagePath: string; originalName: string; thumbPath: string | null }[],
    ip?: string
  ) {
    const today = new Date();
    const entryDate = today.toISOString().split('T')[0];
    const { isoWeek, isoYear } = getISOWeekInfo(today);

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO daily_entries
          (user_id, country_id, campaign_id, entry_date, iso_year, iso_week,
           clientes, clientes_efectivos, menores)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          userId, countryId, campaignId, entryDate, isoYear, isoWeek,
          data.clientes, data.clientes_efectivos, data.menores,
        ]
      );

      const entry = result.rows[0];

      // Insert images into entry_images table
      for (const img of images) {
        await client.query(
          `INSERT INTO entry_images (entry_id, image_path, original_name, thumb_path)
           VALUES ($1, $2, $3, $4)`,
          [entry.id, img.imagePath, img.originalName, img.thumbPath]
        );
      }

      await client.query('COMMIT');

      await logAudit(userId, 'ENTRY_CREATED', 'daily_entry', entry.id, {
        clientes: data.clientes,
        clientes_efectivos: data.clientes_efectivos,
        menores: data.menores,
        images_count: images.length,
      }, ip);

      return entry;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getEntries(userId: number, queryParams: any) {
    const { page, limit, offset } = parsePagination(queryParams);

    const countResult = await query(
      'SELECT COUNT(*) FROM daily_entries WHERE user_id = $1',
      [userId]
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
      `SELECT de.*, c.name as country_name, camp.name as campaign_name
       FROM daily_entries de
       LEFT JOIN countries c ON c.id = de.country_id
       LEFT JOIN campaigns camp ON camp.id = de.campaign_id
       WHERE de.user_id = $1
       ORDER BY de.entry_date DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return { data: result.rows, meta: buildPaginationMeta(page, limit, total) };
  }

  async getEntryById(id: number, userId: number) {
    const result = await query(
      `SELECT de.*, c.name as country_name, camp.name as campaign_name
       FROM daily_entries de
       LEFT JOIN countries c ON c.id = de.country_id
       LEFT JOIN campaigns camp ON camp.id = de.campaign_id
       WHERE de.id = $1 AND de.user_id = $2`,
      [id, userId]
    );
    if (result.rows.length === 0) {
      throw { status: 404, code: 'ENTRY_NOT_FOUND', message: 'Entrada no encontrada' };
    }
    return result.rows[0];
  }

  async getWeeklySummary(userId: number, isoYear?: number, isoWeek?: number) {
    const now = new Date();
    const currentInfo = getISOWeekInfo(now);
    const year = isoYear || currentInfo.isoYear;
    const week = isoWeek || currentInfo.isoWeek;

    const result = await query(
      `SELECT
        iso_year, iso_week,
        COUNT(*) as days_with_entries,
        SUM(clientes) as total_clientes,
        SUM(clientes_efectivos) as total_clientes_efectivos,
        SUM(menores) as total_menores,
        CASE WHEN SUM(clientes) > 0
          THEN ROUND(SUM(clientes_efectivos)::numeric / SUM(clientes)::numeric, 4)
          ELSE 0 END as effectiveness_rate
       FROM daily_entries
       WHERE user_id = $1 AND iso_year = $2 AND iso_week = $3
       GROUP BY iso_year, iso_week`,
      [userId, year, week]
    );

    if (result.rows.length === 0) {
      return {
        iso_year: year, iso_week: week, days_with_entries: 0,
        total_clientes: 0, total_clientes_efectivos: 0, total_menores: 0,
        effectiveness_rate: 0,
      };
    }
    return result.rows[0];
  }
}

export const conglomeradoService = new ConglomeradoService();
