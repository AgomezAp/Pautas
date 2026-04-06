import { Router } from 'express';
import { authController } from './auth.controller';
import { loginValidators, changePasswordValidators } from './auth.validators';
import { validate } from '../../middleware/validate.middleware';
import { authMiddleware } from '../../middleware/auth.middleware';
import { loginLimiter } from '../../middleware/rate-limit.middleware';

const router = Router();

router.post('/login', loginLimiter, loginValidators, validate, (req, res, next) => authController.login(req, res, next));
router.post('/refresh', (req, res, next) => authController.refresh(req, res, next));
router.post('/logout', (req, res, next) => authController.logout(req, res, next));
router.get('/me', authMiddleware, (req, res, next) => authController.me(req, res, next));
router.put('/change-password', authMiddleware, changePasswordValidators, validate, (req, res, next) => authController.changePassword(req, res, next));

export { router as authRoutes };
