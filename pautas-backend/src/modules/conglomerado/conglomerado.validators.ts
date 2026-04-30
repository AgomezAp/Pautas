import { body } from 'express-validator';

export const createEntryValidators = [
  body('clientes').isInt({ min: 0 }).withMessage('Clientes debe ser un número entero >= 0'),
  body('clientes_efectivos').isInt({ min: 0 }).withMessage('Clientes efectivos debe ser un número entero >= 0'),
  body('menores').isInt({ min: 0 }).withMessage('Menores debe ser un número entero >= 0'),
  body('cierre').optional({ nullable: true, checkFalsy: true })
    .isFloat({ min: 0 }).withMessage('Cierre debe ser un número >= 0'),
];
