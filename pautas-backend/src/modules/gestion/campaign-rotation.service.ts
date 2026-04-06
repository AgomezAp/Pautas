import { query, getClient } from '../../config/database';
import { logAudit } from '../../services/audit.service';
import { parsePagination, buildPaginationMeta } from '../../utils/pagination.util';

export class CampaignRotationService {
  /**
   * Rota una campaña de un usuario a otro.
   * Si el nuevo usuario ya tiene una campaña asignada, se intercambian (swap).
   */
  async rotateCampaign(
    campaignId: number,
    newUserId: number,
    rotatedBy: number,
    reason: string | null,
    effectiveDate: string | null,
    ip?: string
  ) {
    const client = await getClient();
    try {
      await client.query('BEGIN');

      // Validate campaign exists and is active
      const campaign = await client.query(
        'SELECT id, name, country_id FROM campaigns WHERE id = $1 AND is_active = TRUE',
        [campaignId]
      );
      if (campaign.rows.length === 0) {
        throw { status: 404, code: 'CAMPAIGN_NOT_FOUND', message: 'Campaña no encontrada o inactiva' };
      }

      // Validate new user exists and is conglomerado
      const newUser = await client.query(
        `SELECT u.id, u.full_name, u.campaign_id FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE u.id = $1 AND r.name = 'conglomerado' AND u.is_active = TRUE`,
        [newUserId]
      );
      if (newUser.rows.length === 0) {
        throw { status: 400, code: 'INVALID_USER', message: 'El usuario destino no es válido o no es de tipo Conglomerado' };
      }

      // Get current holder of this campaign
      const currentHolder = await client.query(
        'SELECT u.id, u.full_name, u.campaign_id FROM users u WHERE u.campaign_id = $1 AND u.is_active = TRUE',
        [campaignId]
      );
      const previousUserId = currentHolder.rows.length > 0 ? currentHolder.rows[0].id : null;
      const previousUserName = currentHolder.rows.length > 0 ? currentHolder.rows[0].full_name : null;

      // Prevent assigning to same user
      if (previousUserId === newUserId) {
        throw { status: 400, code: 'SAME_USER', message: 'La campaña ya está asignada a este usuario' };
      }

      const resolvedDate = effectiveDate || new Date().toISOString().split('T')[0];

      // Check if new user already has a campaign (swap scenario)
      const newUserCurrentCampaignId = newUser.rows[0].campaign_id;
      let swapInfo: any = null;

      if (newUserCurrentCampaignId) {
        // SWAP: el nuevo usuario ya tiene campaña, se intercambian
        const swapCampaign = await client.query(
          'SELECT name FROM campaigns WHERE id = $1', [newUserCurrentCampaignId]
        );

        if (previousUserId) {
          // El usuario anterior recibe la campaña del nuevo usuario
          await client.query('UPDATE users SET campaign_id = $1 WHERE id = $2', [newUserCurrentCampaignId, previousUserId]);
        } else {
          // No había usuario anterior: la campaña anterior del nuevo usuario queda sin asignar
        }

        // El nuevo usuario recibe la campaña target
        await client.query('UPDATE users SET campaign_id = $1 WHERE id = $2', [campaignId, newUserId]);

        swapInfo = {
          swapped: true,
          swapped_campaign_id: newUserCurrentCampaignId,
          swapped_campaign_name: swapCampaign.rows[0]?.name,
        };

        // Registrar la rotación inversa (parte del swap)
        if (previousUserId) {
          await client.query(
            `INSERT INTO campaign_rotations
              (campaign_id, previous_user_id, new_user_id, rotated_by, reason, effective_date)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              newUserCurrentCampaignId,
              newUserId,
              previousUserId,
              rotatedBy,
              reason ? `[INTERCAMBIO] ${reason}` : '[INTERCAMBIO] Rotación cruzada de campañas',
              resolvedDate,
            ]
          );
        }
      } else {
        // Rotación simple: mover la campaña
        if (previousUserId) {
          await client.query('UPDATE users SET campaign_id = NULL WHERE id = $1', [previousUserId]);
        }
        await client.query('UPDATE users SET campaign_id = $1 WHERE id = $2', [campaignId, newUserId]);
      }

      // Registrar la rotación principal
      const rotation = await client.query(
        `INSERT INTO campaign_rotations
          (campaign_id, previous_user_id, new_user_id, rotated_by, reason, effective_date)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [campaignId, previousUserId, newUserId, rotatedBy, reason, resolvedDate]
      );

      await client.query('COMMIT');

      await logAudit(rotatedBy, 'CAMPAIGN_ROTATED', 'campaign_rotation', rotation.rows[0].id, {
        campaign_id: campaignId,
        campaign_name: campaign.rows[0].name,
        previous_user_id: previousUserId,
        previous_user_name: previousUserName,
        new_user_id: newUserId,
        new_user_name: newUser.rows[0].full_name,
        swap: swapInfo,
        reason,
      }, ip);

      return {
        ...rotation.rows[0],
        campaign_name: campaign.rows[0].name,
        previous_user_name: previousUserName,
        new_user_name: newUser.rows[0].full_name,
        swap: swapInfo,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getRotationHistory(queryParams: any) {
    const { page, limit, offset } = parsePagination(queryParams);
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (queryParams.campaign_id) {
      conditions.push(`cr.campaign_id = $${paramIndex++}`);
      params.push(parseInt(queryParams.campaign_id));
    }
    if (queryParams.country_id) {
      conditions.push(`camp.country_id = $${paramIndex++}`);
      params.push(parseInt(queryParams.country_id));
    }
    if (queryParams.date_from) {
      conditions.push(`cr.effective_date >= $${paramIndex++}`);
      params.push(queryParams.date_from);
    }
    if (queryParams.date_to) {
      conditions.push(`cr.effective_date <= $${paramIndex++}`);
      params.push(queryParams.date_to);
    }
    if (queryParams.user_id) {
      conditions.push(`(cr.previous_user_id = $${paramIndex} OR cr.new_user_id = $${paramIndex++})`);
      params.push(parseInt(queryParams.user_id));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query(
      `SELECT COUNT(*) FROM campaign_rotations cr
       JOIN campaigns camp ON camp.id = cr.campaign_id
       ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
      `SELECT cr.*,
              camp.name as campaign_name,
              c.name as country_name,
              c.code as country_code,
              prev_u.full_name as previous_user_name,
              new_u.full_name as new_user_name,
              rotated_u.full_name as rotated_by_name
       FROM campaign_rotations cr
       JOIN campaigns camp ON camp.id = cr.campaign_id
       JOIN countries c ON c.id = camp.country_id
       LEFT JOIN users prev_u ON prev_u.id = cr.previous_user_id
       JOIN users new_u ON new_u.id = cr.new_user_id
       JOIN users rotated_u ON rotated_u.id = cr.rotated_by
       ${whereClause}
       ORDER BY cr.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset]
    );

    return { data: result.rows, meta: buildPaginationMeta(page, limit, total) };
  }

  async getAvailableConglomeradoUsers(countryId?: number) {
    const conditions = ["r.name = 'conglomerado'", 'u.is_active = TRUE'];
    const params: any[] = [];

    if (countryId) {
      conditions.push(`u.country_id = $1`);
      params.push(countryId);
    }

    const result = await query(
      `SELECT u.id, u.username, u.full_name, u.campaign_id,
              c.name as country_name, c.id as country_id,
              camp.name as current_campaign_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       JOIN countries c ON c.id = u.country_id
       LEFT JOIN campaigns camp ON camp.id = u.campaign_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY c.name, u.full_name`,
      params
    );

    return result.rows;
  }

  /**
   * Lista todas las campañas activas con su usuario asignado actual
   */
  async getActiveCampaigns(countryId?: number) {
    const conditions = ['camp.is_active = TRUE'];
    const params: any[] = [];

    if (countryId) {
      conditions.push(`camp.country_id = $1`);
      params.push(countryId);
    }

    const result = await query(
      `SELECT camp.id, camp.name, camp.google_ads_campaign_id,
              c.name as country_name, c.id as country_id, c.code as country_code,
              u.id as assigned_user_id, u.full_name as assigned_user_name,
              u.username as assigned_username
       FROM campaigns camp
       JOIN countries c ON c.id = camp.country_id
       LEFT JOIN users u ON u.campaign_id = camp.id AND u.is_active = TRUE
       WHERE ${conditions.join(' AND ')}
       ORDER BY c.name, camp.name`,
      params
    );

    return result.rows;
  }
}

export const campaignRotationService = new CampaignRotationService();
