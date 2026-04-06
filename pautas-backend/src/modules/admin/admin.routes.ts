import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roleMiddleware } from '../../middleware/role.middleware';
import { usersRoutes } from './users/users.routes';
import { campaignsRoutes } from './campaigns/campaigns.routes';
import { countriesRoutes } from './countries/countries.routes';
import { query } from '../../config/database';
import { sendSuccess } from '../../utils/response.util';
import { parsePagination, buildPaginationMeta } from '../../utils/pagination.util';
import { googleAdsSyncService } from '../../services/google-ads-sync.service';

const router = Router();

// All admin routes require admin role
router.use(authMiddleware, roleMiddleware('admin'));

router.use('/users', usersRoutes);
router.use('/campaigns', campaignsRoutes);
router.use('/countries', countriesRoutes);

// Audit log
router.get('/audit-log', async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const { action, username, date_from, date_to } = req.query as any;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (action) {
      conditions.push(`al.action = $${paramIndex++}`);
      params.push(action);
    }
    if (username) {
      conditions.push(`u.username ILIKE $${paramIndex++}`);
      params.push(`%${username}%`);
    }
    if (date_from) {
      conditions.push(`al.created_at >= $${paramIndex++}`);
      params.push(date_from);
    }
    if (date_to) {
      conditions.push(`al.created_at <= ($${paramIndex++})::date + interval '1 day'`);
      params.push(date_to);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const countResult = await query(
      `SELECT COUNT(*) FROM audit_log al LEFT JOIN users u ON u.id = al.user_id ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const dataParams = [...params, limit, offset];
    const result = await query(
      `SELECT al.*, u.username, u.full_name
       FROM audit_log al
       LEFT JOIN users u ON u.id = al.user_id
       ${whereClause}
       ORDER BY al.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      dataParams
    );
    return sendSuccess(res, result.rows, buildPaginationMeta(page, limit, total));
  } catch (err) { next(err); }
});

// Admin dashboard stats
router.get('/stats', async (_req, res, next) => {
  try {
    const [usersCount, campaignsCount, entriesCount, countriesCount] = await Promise.all([
      query('SELECT COUNT(*) FROM users WHERE is_active = TRUE'),
      query('SELECT COUNT(*) FROM campaigns WHERE is_active = TRUE'),
      query('SELECT COUNT(*) FROM daily_entries'),
      query('SELECT COUNT(*) FROM countries WHERE is_active = TRUE'),
    ]);

    const roleBreakdown = await query(
      `SELECT r.name, COUNT(u.id) as count
       FROM roles r LEFT JOIN users u ON u.role_id = r.id AND u.is_active = TRUE
       GROUP BY r.name`
    );

    return sendSuccess(res, {
      totalUsers: parseInt(usersCount.rows[0].count),
      totalCampaigns: parseInt(campaignsCount.rows[0].count),
      totalEntries: parseInt(entriesCount.rows[0].count),
      totalCountries: parseInt(countriesCount.rows[0].count),
      usersByRole: roleBreakdown.rows,
    });
  } catch (err) { next(err); }
});

// Roles list (for dropdowns)
router.get('/roles', async (_req, res, next) => {
  try {
    const result = await query('SELECT id, name, description FROM roles ORDER BY id');
    return sendSuccess(res, result.rows);
  } catch (err) { next(err); }
});

// Conglomerado entries (admin view)
router.get('/conglomerado-entries', async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const { country_id, date_from, date_to, search } = req.query as any;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (country_id) {
      conditions.push('de.country_id = $' + paramIndex);
      params.push(parseInt(country_id));
      paramIndex++;
    }
    if (date_from) {
      conditions.push('de.entry_date >= $' + paramIndex);
      params.push(date_from);
      paramIndex++;
    }
    if (date_to) {
      conditions.push('de.entry_date <= $' + paramIndex);
      params.push(date_to);
      paramIndex++;
    }
    if (search) {
      conditions.push('(u.full_name ILIKE $' + paramIndex + ' OR u.username ILIKE $' + paramIndex + ')');
      params.push('%' + search + '%');
      paramIndex++;
    }

    const whereClause = conditions.length > 0
      ? 'WHERE ' + conditions.join(' AND ')
      : '';

    const countResult = await query(
      'SELECT COUNT(*) FROM daily_entries de JOIN users u ON u.id = de.user_id ' + whereClause,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const dataParams = [...params, limit, offset];
    const result = await query(
      'SELECT de.id, de.entry_date, de.clientes, de.clientes_efectivos, de.menores, ' +
      'de.soporte_image_path, de.created_at, ' +
      'u.id as user_id, u.full_name, u.username, u.google_ads_account_id, ' +
      'c.name as country_name, c.code as country_code, ' +
      'camp.name as campaign_name ' +
      'FROM daily_entries de ' +
      'JOIN users u ON u.id = de.user_id ' +
      'JOIN countries c ON c.id = de.country_id ' +
      'LEFT JOIN campaigns camp ON camp.id = de.campaign_id ' +
      whereClause + ' ' +
      'ORDER BY de.entry_date DESC, u.full_name ' +
      'LIMIT $' + paramIndex + ' OFFSET $' + (paramIndex + 1),
      dataParams
    );

    return sendSuccess(res, result.rows, buildPaginationMeta(page, limit, total));
  } catch (err) { next(err); }
});

// Recharges dashboard metrics
router.get('/recharges-dashboard', async (req, res, next) => {
  try {
    const { country, dateFrom, dateTo, account, paymentProfile } = req.query as any;
    const data = await googleAdsSyncService.getRechargesDashboard({
      country, dateFrom, dateTo, account, paymentProfile,
    });
    return sendSuccess(res, data);
  } catch (err) { next(err); }
});

export { router as adminRoutes };
