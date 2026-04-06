import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roleMiddleware } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import { alertsController } from './alerts.controller';
import { updateThresholdValidators, alertIdValidator } from './alerts.validators';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// ─── Alertas (admin, pautador, gestion_administrativa) ──────

const alertViewRoles = roleMiddleware('admin', 'pautador', 'gestion_administrativa');

router.get('/', alertViewRoles, (req, res, next) => alertsController.getAlerts(req, res, next));
router.get('/summary', alertViewRoles, (req, res, next) => alertsController.getSummary(req, res, next));
router.get('/trend', alertViewRoles, (req, res, next) => alertsController.getTrend(req, res, next));
router.get('/top-alerted', alertViewRoles, (req, res, next) => alertsController.getTopAlerted(req, res, next));
router.get('/ranking', alertViewRoles, (req, res, next) => alertsController.getRanking(req, res, next));
router.get('/ads-comparison', alertViewRoles, (req, res, next) => alertsController.getAdsComparison(req, res, next));

// ─── Acciones sobre alertas ─────────────────────────────────

const alertActionRoles = roleMiddleware('admin', 'pautador');

router.patch('/:id/acknowledge', alertActionRoles, alertIdValidator, validate, (req, res, next) => alertsController.acknowledge(req, res, next));
router.patch('/:id/resolve', alertActionRoles, alertIdValidator, validate, (req, res, next) => alertsController.resolve(req, res, next));
router.patch('/:id/dismiss', alertActionRoles, alertIdValidator, validate, (req, res, next) => alertsController.dismiss(req, res, next));

// ─── Thresholds (solo admin) ────────────────────────────────

const adminOnly = roleMiddleware('admin');

router.get('/thresholds', alertViewRoles, (req, res, next) => alertsController.getThresholds(req, res, next));
router.put('/thresholds', adminOnly, updateThresholdValidators, validate, (req, res, next) => alertsController.upsertThreshold(req, res, next));

export { router as alertsRoutes };
