import { body, param } from 'express-validator';

export const updateThresholdValidators = [
  body('alert_type')
    .isString()
    .isIn(['CONVERSION_DROP', 'TRAFFIC_DROP', 'HIGH_MINORS_RATIO', 'CONVERSION_SPIKE', 'NO_REPORT', 'TREND_DECLINING', 'ADS_DISCREPANCY'])
    .withMessage('Tipo de alerta inválido'),
  body('threshold_value')
    .isFloat({ min: 0, max: 100 })
    .withMessage('El umbral debe ser un número entre 0 y 100'),
  body('country_id')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage('ID de país inválido'),
  body('campaign_id')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage('ID de campaña inválido'),
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active debe ser booleano'),
];

export const alertIdValidator = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID de alerta inválido'),
];
