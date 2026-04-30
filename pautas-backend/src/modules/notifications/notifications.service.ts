import { query } from '../../config/database';
import { websocketService } from '../../services/websocket.service';

export class NotificationsService {
  async getNotifications(userId: number, onlyUnread = false) {
    const condition = onlyUnread ? 'AND is_read = FALSE' : '';
    const result = await query(
      `SELECT id, type, title, message, data, is_read, created_at
       FROM notifications
       WHERE user_id = $1 ${condition}
       ORDER BY created_at DESC
       LIMIT 100`,
      [userId]
    );
    return result.rows;
  }

  async getUnreadCount(userId: number): Promise<number> {
    const result = await query(
      `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE`,
      [userId]
    );
    return parseInt(result.rows[0].count, 10);
  }

  async markAsRead(userId: number, notificationId: number) {
    const result = await query(
      `UPDATE notifications SET is_read = TRUE
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [notificationId, userId]
    );
    return result.rows[0] || null;
  }

  async markAllAsRead(userId: number) {
    await query(
      `UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE`,
      [userId]
    );
  }

  /**
   * Create a notification and push it via WebSocket if possible.
   */
  async createNotification(params: {
    userId: number;
    type: string;
    title: string;
    message: string;
    data?: Record<string, any>;
  }): Promise<void> {
    const result = await query(
      `INSERT INTO notifications (user_id, type, title, message, data)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, type, title, message, data, is_read, created_at`,
      [params.userId, params.type, params.title, params.message, params.data ? JSON.stringify(params.data) : null]
    );
    const notification = result.rows[0];
    // Push real-time via WebSocket
    websocketService.sendToUser(params.userId, 'notification', notification);
  }

  /**
   * Find the gestion_administrativa users assigned to a given country
   * (checks user_countries first, falls back to users.country_id).
   */
  async getGestionUsersForCountry(countryId: number): Promise<number[]> {
    const result = await query(
      `SELECT DISTINCT u.id
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE r.name = 'gestion_administrativa'
         AND u.is_active = TRUE
         AND (
           u.id IN (
             SELECT user_id FROM user_countries WHERE country_id = $1
           )
           OR u.country_id = $1
         )`,
      [countryId]
    );
    return result.rows.map((r: any) => r.id);
  }
}

export const notificationsService = new NotificationsService();
