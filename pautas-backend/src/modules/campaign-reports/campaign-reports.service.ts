import { query } from '../../config/database';
import { notificationsService } from '../notifications/notifications.service';
import { parsePagination, buildPaginationMeta } from '../../utils/pagination.util';

export class CampaignReportsService {
  /**
   * Pautador submits a change report for a campaign.
   * Notifies all gestion_administrativa users assigned to that campaign's country.
   */
  async createReport(params: {
    pautadorId: number;
    campaignId: number;
    description: string;
    pautadorName: string;
  }): Promise<any> {
    // Verify campaign exists and get its country
    const campRow = await query(
      `SELECT c.id, c.name, c.country_id, co.name as country_name
       FROM campaigns c
       JOIN countries co ON co.id = c.country_id
       WHERE c.id = $1`,
      [params.campaignId]
    );
    if (campRow.rows.length === 0) {
      throw Object.assign(new Error('Campaña no encontrada'), { statusCode: 404 });
    }
    const campaign = campRow.rows[0];

    // Save the report
    const result = await query(
      `INSERT INTO campaign_change_reports (pautador_id, campaign_id, description)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [params.pautadorId, params.campaignId, params.description]
    );
    const report = result.rows[0];

    // Notify gestion_administrativa users of that country
    const gestionUsers = await notificationsService.getGestionUsersForCountry(campaign.country_id);
    const shortDesc = params.description.length > 120
      ? params.description.substring(0, 120) + '…'
      : params.description;

    const notifPromises = gestionUsers.map(userId =>
      notificationsService.createNotification({
        userId,
        type: 'campaign_change_report',
        title: `Cambio en campaña: ${campaign.name}`,
        message: `${params.pautadorName}: ${shortDesc}`,
        data: {
          report_id: report.id,
          campaign_id: campaign.id,
          campaign_name: campaign.name,
          country_id: campaign.country_id,
          country_name: campaign.country_name,
          pautador_id: params.pautadorId,
        },
      })
    );
    await Promise.allSettled(notifPromises);

    return { ...report, campaign_name: campaign.name, country_name: campaign.country_name };
  }

  /**
   * Get reports — for gestion_administrativa (filtered by their countries).
   * For pautador: only their own reports.
   */
  async getReports(params: {
    role: string;
    userId: number;
    countryIds?: number[];
    campaignId?: number;
    page?: number;
    limit?: number;
  }) {
    const { page, limit, offset } = parsePagination({ page: params.page, limit: params.limit });
    const conditions: string[] = [];
    const qParams: any[] = [];
    let idx = 1;

    if (params.role === 'pautador') {
      conditions.push(`ccr.pautador_id = $${idx++}`);
      qParams.push(params.userId);
    } else if (params.countryIds && params.countryIds.length > 0) {
      conditions.push(`c.country_id = ANY($${idx++}::int[])`);
      qParams.push(params.countryIds);
    }

    if (params.campaignId) {
      conditions.push(`ccr.campaign_id = $${idx++}`);
      qParams.push(params.campaignId);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query(
      `SELECT COUNT(*) FROM campaign_change_reports ccr
       JOIN campaigns c ON c.id = ccr.campaign_id
       ${where}`,
      qParams
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataResult = await query(
      `SELECT
         ccr.id, ccr.description, ccr.sent_at, ccr.created_at,
         c.id AS campaign_id, c.name AS campaign_name, c.google_ads_campaign_id,
         co.id AS country_id, co.name AS country_name,
         u.id AS pautador_id, u.full_name AS pautador_name
       FROM campaign_change_reports ccr
       JOIN campaigns c  ON c.id  = ccr.campaign_id
       JOIN countries co ON co.id = c.country_id
       JOIN users u      ON u.id  = ccr.pautador_id
       ${where}
       ORDER BY ccr.sent_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...qParams, limit, offset]
    );

    return { data: dataResult.rows, meta: buildPaginationMeta(page, limit, total) };
  }

  /** Get campaigns list for the pautador selector — only the pautador's own active campaigns */
  async getCampaignsForPautador(pautadorId: number): Promise<any[]> {
    const result = await query(
      `SELECT c.id, c.name, c.google_ads_campaign_id, co.name AS country_name
       FROM campaigns c
       JOIN countries co ON co.id = c.country_id
       JOIN users u ON u.campaign_id = c.id AND u.id = $1 AND u.is_active = TRUE
       WHERE c.is_active = TRUE
       ORDER BY co.name, c.name`,
      [pautadorId]
    );
    return result.rows;
  }
}

export const campaignReportsService = new CampaignReportsService();
