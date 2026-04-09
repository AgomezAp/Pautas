import { Router } from 'express';
import { body } from 'express-validator';
import { gestionController } from './gestion.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roleMiddleware } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';

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

// Crear usuario conglomerado: gestion_administrativa and admin
const createConglomeradoValidators = [
  body('username').trim().notEmpty().withMessage('El username es requerido')
    .isLength({ min: 3 }).withMessage('El username debe tener al menos 3 caracteres'),
  body('full_name').trim().notEmpty().withMessage('El nombre completo es requerido'),
  body('country_id').isInt({ min: 1 }).withMessage('El país es requerido'),
  body('password').optional().isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres'),
  body('email').optional({ values: 'null' }).isEmail().withMessage('Email inválido'),
  body('campaign_id').optional({ values: 'null' }).isInt({ min: 1 }).withMessage('Campaña inválida'),
];
router.post('/conglomerado-users', roleMiddleware('gestion_administrativa', 'admin'), createConglomeradoValidators, validate, (req, res, next) => gestionController.createConglomeradoUser(req, res, next));

// Soporte images: entries with uploaded images
router.get('/soporte-images', roleMiddleware('gestion_administrativa', 'admin'), (req, res, next) => gestionController.getEntriesWithImages(req, res, next));

// Reset (hard delete) a conglomerado daily entry
router.delete('/entries/:entryId', roleMiddleware('gestion_administrativa', 'admin'), (req, res, next) => gestionController.resetEntry(req, res, next));

// Reset password for a conglomerado user
router.patch('/conglomerado-users/:userId/reset-password', roleMiddleware('gestion_administrativa', 'admin'), (req, res, next) => gestionController.resetPassword(req, res, next));

export { router as gestionRoutes };
