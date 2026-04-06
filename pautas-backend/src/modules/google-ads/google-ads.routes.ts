import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roleMiddleware } from '../../middleware/role.middleware';
import { googleAdsSyncService } from '../../services/google-ads-sync.service';
import { sendSuccess } from '../../utils/response.util';
import { parsePagination, buildPaginationMeta } from '../../utils/pagination.util';

const router = Router();

router.use(authMiddleware, roleMiddleware('admin', 'pautador', 'gestion_administrativa'));

// GET /google-ads/campaigns - Campaign details with latest metrics
router.get('/campaigns', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const countryId = req.query.country_id ? Number(req.query.country_id) : undefined;
    const data = await googleAdsSyncService.getCampaignDetails(countryId);
    return sendSuccess(res, data);
  } catch (err) { next(err); }
});

// GET /google-ads/campaigns/:id/history - Campaign performance history
router.get('/campaigns/:id/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const campaignId = Number(req.params.id);
    const days = req.query.days ? Number(req.query.days) : 30;
    const data = await googleAdsSyncService.getCampaignHistory(campaignId, days);
    return sendSuccess(res, data);
  } catch (err) { next(err); }
});

// GET /google-ads/billing/accounts - Billing accounts
router.get('/billing/accounts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await googleAdsSyncService.getBillingAccounts();
    return sendSuccess(res, data);
  } catch (err) { next(err); }
});

// GET /google-ads/billing/history - Billing/invoice history
router.get('/billing/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const { rows, total } = await googleAdsSyncService.getBillingHistory(limit, offset);
    return sendSuccess(res, rows, buildPaginationMeta(page, limit, total));
  } catch (err) { next(err); }
});

// POST /google-ads/sync - Trigger manual sync (admin only)
router.post('/sync', roleMiddleware('admin'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await googleAdsSyncService.syncAll();
    return sendSuccess(res, { message: 'Sincronización completada' });
  } catch (err) { next(err); }
});

export { router as googleAdsRoutes };
