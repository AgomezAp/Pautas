import { Router } from 'express';
import { campaignReportsController } from './campaign-reports.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roleMiddleware } from '../../middleware/role.middleware';

const router = Router();

router.use(authMiddleware);

// Campaign list for selector (pautadores)
router.get('/campaigns',
  roleMiddleware('pautador'),
  (req, res, next) => campaignReportsController.getCampaigns(req, res, next)
);

// Create report (pautadores only)
router.post('/',
  roleMiddleware('pautador'),
  (req, res, next) => campaignReportsController.create(req, res, next)
);

// View history (pautadores see own; gestion_administrativa sees all for their countries)
router.get('/',
  roleMiddleware('pautador', 'gestion_administrativa'),
  (req, res, next) => campaignReportsController.getAll(req, res, next)
);

export { router as campaignReportsRoutes };
