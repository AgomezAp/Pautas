import rateLimit from 'express-rate-limit';

export const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Demasiados intentos de login. Intente de nuevo en 1 minuto.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Demasiadas solicitudes. Intente de nuevo en 1 minuto.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});
