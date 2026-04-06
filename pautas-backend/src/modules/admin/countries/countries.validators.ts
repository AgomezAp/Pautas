import { body } from 'express-validator';

export const createCountryValidators = [
  body('name').trim().notEmpty().withMessage('El nombre es requerido')
    .isString().withMessage('El nombre debe ser texto')
    .isLength({ min: 2 }).withMessage('El nombre debe tener al menos 2 caracteres'),
  body('code').trim().notEmpty().withMessage('El código es requerido')
    .isString().withMessage('El código debe ser texto')
    .isLength({ min: 2, max: 5 }).withMessage('El código debe tener entre 2 y 5 caracteres')
    .toUpperCase(),
  body('google_sheet_tab').optional({ values: 'null' })
    .isString().withMessage('El tab de Google Sheet debe ser texto'),
  body('timezone').optional({ values: 'null' })
    .isString().withMessage('La zona horaria debe ser texto'),
  body('is_active').optional()
    .isBoolean().withMessage('is_active debe ser un valor booleano'),
];

export const updateCountryValidators = [
  body('name').optional().trim().notEmpty().withMessage('El nombre no puede estar vacío')
    .isString().withMessage('El nombre debe ser texto')
    .isLength({ min: 2 }).withMessage('El nombre debe tener al menos 2 caracteres'),
  body('code').optional().trim().notEmpty().withMessage('El código no puede estar vacío')
    .isString().withMessage('El código debe ser texto')
    .isLength({ min: 2, max: 5 }).withMessage('El código debe tener entre 2 y 5 caracteres')
    .toUpperCase(),
  body('google_sheet_tab').optional({ values: 'null' })
    .isString().withMessage('El tab de Google Sheet debe ser texto'),
  body('timezone').optional({ values: 'null' })
    .isString().withMessage('La zona horaria debe ser texto'),
  body('is_active').optional()
    .isBoolean().withMessage('is_active debe ser un valor booleano'),
];
