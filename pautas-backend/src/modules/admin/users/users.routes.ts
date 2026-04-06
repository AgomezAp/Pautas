import { Router } from 'express';
import { usersController } from './users.controller';
import { createUserValidators, updateUserValidators } from './users.validators';
import { validate } from '../../../middleware/validate.middleware';

const router = Router();

router.get('/', (req, res, next) => usersController.list(req, res, next));
router.get('/google-ads-accounts', usersController.getAllGoogleAdsAccounts.bind(usersController));
router.get('/:id', (req, res, next) => usersController.getById(req, res, next));
router.get('/:id/google-ads-accounts', usersController.getPautadorAccounts.bind(usersController));
router.put('/:id/google-ads-accounts', usersController.setPautadorAccounts.bind(usersController));
router.post('/', createUserValidators, validate, (req, res, next) => usersController.create(req, res, next));
router.put('/:id', updateUserValidators, validate, (req, res, next) => usersController.update(req, res, next));
router.patch('/:id/toggle-active', (req, res, next) => usersController.toggleActive(req, res, next));
router.delete('/:id', (req, res, next) => usersController.delete(req, res, next));

export { router as usersRoutes };
