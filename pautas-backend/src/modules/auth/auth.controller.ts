import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import { sendSuccess, sendError } from '../../utils/response.util';

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { username, password } = req.body;
      const ip = req.ip || req.socket.remoteAddress;
      const result = await authService.login(username, password, ip);

      // Set refresh token as httpOnly cookie
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/api/v1/auth',
      });

      return sendSuccess(res, {
        accessToken: result.accessToken,
        user: result.user,
      });
    } catch (err: any) {
      if (err.status) {
        return sendError(res, err.code, err.message, err.status);
      }
      next(err);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const refreshToken = req.cookies?.refreshToken;
      if (!refreshToken) {
        return sendError(res, 'NO_TOKEN', 'Refresh token no proporcionado', 401);
      }

      const result = await authService.refreshAccessToken(refreshToken);

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/api/v1/auth',
      });

      return sendSuccess(res, { accessToken: result.accessToken });
    } catch (err: any) {
      if (err.status) {
        return sendError(res, err.code, err.message, err.status);
      }
      next(err);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const refreshToken = req.cookies?.refreshToken;
      if (refreshToken) {
        await authService.logout(refreshToken);
      }

      res.clearCookie('refreshToken', { path: '/api/v1/auth' });
      return sendSuccess(res, { message: 'Sesión cerrada exitosamente' });
    } catch (err) {
      next(err);
    }
  }

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      const profile = await authService.getProfile(req.user!.sub);
      return sendSuccess(res, profile);
    } catch (err: any) {
      if (err.status) {
        return sendError(res, err.code, err.message, err.status);
      }
      next(err);
    }
  }

  async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { currentPassword, newPassword } = req.body;
      await authService.changePassword(req.user!.sub, currentPassword, newPassword);

      res.clearCookie('refreshToken', { path: '/api/v1/auth' });
      return sendSuccess(res, { message: 'Contraseña actualizada exitosamente. Inicie sesión nuevamente.' });
    } catch (err: any) {
      if (err.status) {
        return sendError(res, err.code, err.message, err.status);
      }
      next(err);
    }
  }
}

export const authController = new AuthController();
