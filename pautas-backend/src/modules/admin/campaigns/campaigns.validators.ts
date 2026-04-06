import { body } from 'express-validator';

export const createCampaignValidators = [
  body('name').trim().notEmpty().withMessage('El nombre de la campaña es requerido'),
  body('country_id').isInt({ min: 1 }).withMessage('El país es requerido'),
  body('google_ads_campaign_id').optional().trim(),
  body('campaign_url').optional().trim(),
];

export const updateCampaignValidators = [
  body('name').optional().trim().notEmpty().withMessage('El nombre no puede estar vacío'),
  body('country_id').optional().isInt({ min: 1 }).withMessage('País inválido'),
];
