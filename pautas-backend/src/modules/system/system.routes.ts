import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roleMiddleware } from '../../middleware/role.middleware';
import { countriesService } from '../admin/countries/countries.service';
import { sendSuccess } from '../../utils/response.util';

const router = Router();

// Public: list active countries (for dropdowns on login, etc.)
router.get('/countries', async (_req, res, next) => {
  try {
    const countries = await countriesService.list(true);
    return sendSuccess(res, countries);
  } catch (err) { next(err); }
});

// Health check
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Protected system routes
router.post('/sync/google-ads', authMiddleware, roleMiddleware('admin'), async (_req, res) => {
  // Placeholder for Google Ads sync trigger
  return sendSuccess(res, { message: 'Sincronización de Google Ads iniciada' });
});

export { router as systemRoutes };
