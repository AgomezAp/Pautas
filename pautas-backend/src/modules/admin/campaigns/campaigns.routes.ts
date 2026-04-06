import { Router } from 'express';
import { campaignsController } from './campaigns.controller';
import { createCampaignValidators, updateCampaignValidators } from './campaigns.validators';
import { validate } from '../../../middleware/validate.middleware';

const router = Router();

router.get('/', (req, res, next) => campaignsController.list(req, res, next));
router.get('/:id', (req, res, next) => campaignsController.getById(req, res, next));
router.post('/', createCampaignValidators, validate, (req, res, next) => campaignsController.create(req, res, next));
router.put('/:id', updateCampaignValidators, validate, (req, res, next) => campaignsController.update(req, res, next));

export { router as campaignsRoutes };
