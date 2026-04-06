import { Router } from 'express';
import { gestionController } from './gestion.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roleMiddleware } from '../../middleware/role.middleware';

const router = Router();

router.use(authMiddleware);

// Reports: only gestion_administrativa
router.get('/dashboard/kpis', roleMiddleware('gestion_administrativa'), (req, res, next) => gestionController.getDashboardKpis(req, res, next));
router.get('/reports/effectiveness', roleMiddleware('gestion_administrativa'), (req, res, next) => gestionController.getEffectivenessReport(req, res, next));
router.get('/reports/conversions', roleMiddleware('gestion_administrativa'), (req, res, next) => gestionController.getConversionReport(req, res, next));
router.get('/reports/by-country', roleMiddleware('gestion_administrativa'), (req, res, next) => gestionController.getByCountryReport(req, res, next));
router.get('/reports/by-week', roleMiddleware('gestion_administrativa'), (req, res, next) => gestionController.getByWeekReport(req, res, next));
router.get('/export/excel', roleMiddleware('gestion_administrativa'), (req, res, next) => gestionController.exportExcel(req, res, next));
router.get('/export/pdf', roleMiddleware('gestion_administrativa'), (req, res, next) => gestionController.exportPdf(req, res, next));

// Campaign rotation: gestion_administrativa AND admin can manage rotations
router.post('/rotations', roleMiddleware('gestion_administrativa', 'admin'), (req, res, next) => gestionController.rotateCampaign(req, res, next));
router.get('/rotations', roleMiddleware('gestion_administrativa', 'admin'), (req, res, next) => gestionController.getRotationHistory(req, res, next));
router.get('/rotations/available-users', roleMiddleware('gestion_administrativa', 'admin'), (req, res, next) => gestionController.getAvailableUsers(req, res, next));
router.get('/rotations/campaigns', roleMiddleware('gestion_administrativa', 'admin'), (req, res, next) => gestionController.getActiveCampaigns(req, res, next));

// Conglomerado user management: gestion_administrativa and admin
router.get('/conglomerado-users', roleMiddleware('gestion_administrativa', 'admin'), (req, res, next) => gestionController.getConglomeradoUsers(req, res, next));
router.patch('/conglomerado-users/:id/google-ads-account', roleMiddleware('gestion_administrativa', 'admin'), (req, res, next) => gestionController.updateConglomeradoGoogleAdsAccount(req, res, next));

// Soporte images: entries with uploaded images
router.get('/soporte-images', roleMiddleware('gestion_administrativa', 'admin'), (req, res, next) => gestionController.getEntriesWithImages(req, res, next));

export { router as gestionRoutes };
