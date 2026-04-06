import { Router } from 'express';
import { countriesController } from './countries.controller';
import { createCountryValidators, updateCountryValidators } from './countries.validators';
import { validate } from '../../../middleware/validate.middleware';

const router = Router();

router.get('/', (req, res, next) => countriesController.list(req, res, next));
router.get('/:id', (req, res, next) => countriesController.getById(req, res, next));
router.post('/', createCountryValidators, validate, (req, res, next) => countriesController.create(req, res, next));
router.put('/:id', updateCountryValidators, validate, (req, res, next) => countriesController.update(req, res, next));

export { router as countriesRoutes };
