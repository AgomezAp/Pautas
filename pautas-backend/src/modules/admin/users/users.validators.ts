import { body } from 'express-validator';

export const createUserValidators = [
  body('username').trim().notEmpty().withMessage('El username es requerido')
    .isLength({ min: 3 }).withMessage('El username debe tener al menos 3 caracteres'),
  body('full_name').trim().notEmpty().withMessage('El nombre completo es requerido'),
  body('role_id').isInt({ min: 1 }).withMessage('El rol es requerido'),
  body('password').optional().isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres'),
  body('email').optional({ values: 'null' }).isEmail().withMessage('Email inválido'),
  body('country_id').optional({ values: 'null' }).isInt({ min: 1 }).withMessage('País inválido'),
  body('campaign_id').optional({ values: 'null' }).isInt({ min: 1 }).withMessage('Campaña inválida'),
];

export const updateUserValidators = [
  body('full_name').optional().trim().notEmpty().withMessage('El nombre no puede estar vacío'),
  body('role_id').optional().isInt({ min: 1 }).withMessage('Rol inválido'),
  body('email').optional({ values: 'null' }).isEmail().withMessage('Email inválido'),
  body('password').optional().isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres'),
];
