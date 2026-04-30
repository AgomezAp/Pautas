import { Router } from 'express';
import { contabilidadController } from './contabilidad.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roleMiddleware } from '../../middleware/role.middleware';

const router = Router();

router.use(authMiddleware, roleMiddleware('contabilidad'));

router.get('/kpis',                              (req, res, next) => contabilidadController.getKpis(req, res, next));
router.get('/cierres',                           (req, res, next) => contabilidadController.getCierres(req, res, next));
router.get('/entries/:entryId/vouchers',         (req, res, next) => contabilidadController.getVouchers(req, res, next));
router.patch('/vouchers/:voucherId/review',      (req, res, next) => contabilidadController.reviewVoucher(req, res, next));

export { router as contabilidadRoutes };
