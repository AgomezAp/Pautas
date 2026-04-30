import { query } from '../../config/database';
import { parsePagination, buildPaginationMeta } from '../../utils/pagination.util';
import { toRelativeImagePath } from '../../utils/image-path.util';

export class ContabilidadService {
  /**
   * Get daily entries that have a cierre value or payment vouchers.
   * Contabilidad needs to review and approve these.
   */
  async getCierres(params: {
    countryId?: number;
    dateFrom?: string;
    dateTo?: string;
    userId?: number;
    approvalStatus?: 'pending' | 'approved' | 'rejected';
    page?: number;
    limit?: number;
  }) {
    const { page, limit, offset } = parsePagination({ page: params.page, limit: params.limit });
    const conditions: string[] = ['(de.cierre IS NOT NULL OR EXISTS (SELECT 1 FROM payment_vouchers pv WHERE pv.entry_id = de.id))'];
    const qParams: any[] = [];
    let idx = 1;

    if (params.countryId) {
      conditions.push(`de.country_id = $${idx++}`);
      qParams.push(params.countryId);
    }
    if (params.dateFrom) {
      conditions.push(`de.entry_date >= $${idx++}`);
      qParams.push(params.dateFrom);
    }
    if (params.dateTo) {
      conditions.push(`de.entry_date <= $${idx++}`);
      qParams.push(params.dateTo);
    }
    if (params.userId) {
      conditions.push(`de.user_id = $${idx++}`);
      qParams.push(params.userId);
    }
    if (params.approvalStatus === 'pending') {
      conditions.push(`EXISTS (SELECT 1 FROM payment_vouchers pv WHERE pv.entry_id = de.id AND pv.is_approved IS NULL)`);
    } else if (params.approvalStatus === 'approved') {
      conditions.push(`NOT EXISTS (SELECT 1 FROM payment_vouchers pv WHERE pv.entry_id = de.id AND pv.is_approved IS NOT TRUE)`);
    } else if (params.approvalStatus === 'rejected') {
      conditions.push(`EXISTS (SELECT 1 FROM payment_vouchers pv WHERE pv.entry_id = de.id AND pv.is_approved = FALSE)`);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await query(
      `SELECT COUNT(DISTINCT de.id) FROM daily_entries de ${where}`,
      qParams
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataResult = await query(
      `SELECT
         de.id AS entry_id, de.entry_date, de.cierre,
         de.clientes, de.clientes_efectivos, de.menores,
         u.id AS user_id, u.full_name, u.username,
         c.id AS country_id, c.name AS country_name,
         camp.name AS campaign_name,
         (SELECT COUNT(*) FROM payment_vouchers pv WHERE pv.entry_id = de.id) AS voucher_count,
         (SELECT COUNT(*) FROM payment_vouchers pv WHERE pv.entry_id = de.id AND pv.is_approved = TRUE)  AS approved_count,
         (SELECT COUNT(*) FROM payment_vouchers pv WHERE pv.entry_id = de.id AND pv.is_approved = FALSE) AS rejected_count
       FROM daily_entries de
       JOIN users u      ON u.id  = de.user_id
       JOIN countries c  ON c.id  = de.country_id
       LEFT JOIN campaigns camp ON camp.id = de.campaign_id
       ${where}
       ORDER BY de.entry_date DESC, u.full_name
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...qParams, limit, offset]
    );

    return { data: dataResult.rows, meta: buildPaginationMeta(page, limit, total) };
  }

  /** Get payment vouchers for a specific entry */
  async getVouchers(entryId: number): Promise<any[]> {
    const result = await query(
      `SELECT pv.*, u.full_name AS approved_by_name
       FROM payment_vouchers pv
       LEFT JOIN users u ON u.id = pv.approved_by
       WHERE pv.entry_id = $1
       ORDER BY pv.created_at`,
      [entryId]
    );
    return result.rows.map(row => ({
      ...row,
      image_path: toRelativeImagePath(row.image_path),
      thumb_path: row.thumb_path ? toRelativeImagePath(row.thumb_path) : null,
    }));
  }

  /** Approve or reject a payment voucher */
  async reviewVoucher(params: {
    voucherId: number;
    reviewerId: number;
    isApproved: boolean;
    comment?: string;
  }): Promise<any> {
    const result = await query(
      `UPDATE payment_vouchers
       SET is_approved = $1, approved_by = $2, approved_at = NOW(), approval_comment = $3
       WHERE id = $4
       RETURNING *`,
      [params.isApproved, params.reviewerId, params.comment || null, params.voucherId]
    );
    if (result.rows.length === 0) {
      throw { status: 404, code: 'NOT_FOUND', message: 'Comprobante no encontrado' };
    }
    return result.rows[0];
  }

  /** Get KPIs summary for contabilidad dashboard */
  async getKpis(params: { countryId?: number; dateFrom?: string; dateTo?: string }) {
    const conditions: string[] = ['de.cierre IS NOT NULL'];
    const qParams: any[] = [];
    let idx = 1;

    if (params.countryId) { conditions.push(`de.country_id = $${idx++}`); qParams.push(params.countryId); }
    if (params.dateFrom)  { conditions.push(`de.entry_date >= $${idx++}`); qParams.push(params.dateFrom); }
    if (params.dateTo)    { conditions.push(`de.entry_date <= $${idx++}`); qParams.push(params.dateTo); }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const result = await query(
      `SELECT
         COUNT(*) AS total_cierres,
         SUM(de.cierre) AS total_monto,
         (SELECT COUNT(*) FROM payment_vouchers pv JOIN daily_entries d ON d.id = pv.entry_id
          ${where.replace('de.', 'd.')} AND pv.is_approved IS NULL) AS vouchers_pendientes,
         (SELECT COUNT(*) FROM payment_vouchers pv JOIN daily_entries d ON d.id = pv.entry_id
          ${where.replace('de.', 'd.')} AND pv.is_approved = TRUE) AS vouchers_aprobados
       FROM daily_entries de ${where}`,
      qParams
    );
    return result.rows[0];
  }
}

export const contabilidadService = new ContabilidadService();
