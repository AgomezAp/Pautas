import { query } from '../config/database';

export async function logAudit(
  userId: number | null,
  action: string,
  entityType?: string,
  entityId?: number,
  details?: any,
  ipAddress?: string
) {
  await query(
    `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, action, entityType || null, entityId || null, details ? JSON.stringify(details) : null, ipAddress || null]
  );
}
