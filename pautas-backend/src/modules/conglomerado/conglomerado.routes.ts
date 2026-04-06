import { Router } from 'express';
import { conglomeradoController } from './conglomerado.controller';
import { createEntryValidators } from './conglomerado.validators';
import { validate } from '../../middleware/validate.middleware';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roleMiddleware } from '../../middleware/role.middleware';
import { uploadSoporte } from '../../middleware/upload.middleware';

const router = Router();

router.use(authMiddleware, roleMiddleware('conglomerado'));

router.get('/entry/today', (req, res, next) => conglomeradoController.checkToday(req, res, next));
router.post('/entry', uploadSoporte, createEntryValidators, validate, (req, res, next) => conglomeradoController.createEntry(req, res, next));
router.get('/entries', (req, res, next) => conglomeradoController.getEntries(req, res, next));
router.get('/entries/:id', (req, res, next) => conglomeradoController.getEntryById(req, res, next));
router.get('/weekly-summary', (req, res, next) => conglomeradoController.getWeeklySummary(req, res, next));

export { router as conglomeradoRoutes };
