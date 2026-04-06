import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query } from '../../config/database';
import { env } from '../../config/environment';
import { JwtPayload } from '../../types/express';
import { logAudit } from '../../services/audit.service';

export class AuthService {
  async login(username: string, password: string, ip?: string) {
    const result = await query(
      `SELECT u.id, u.username, u.password_hash, u.full_name, u.is_active,
              u.country_id, u.campaign_id, r.name as role
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.username = $1`,
      [username]
    );

    if (result.rows.length === 0) {
      throw { status: 401, code: 'INVALID_CREDENTIALS', message: 'Usuario o contraseña incorrectos' };
    }

    const user = result.rows[0];

    if (!user.is_active) {
      throw { status: 403, code: 'ACCOUNT_DISABLED', message: 'La cuenta está desactivada' };
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      throw { status: 401, code: 'INVALID_CREDENTIALS', message: 'Usuario o contraseña incorrectos' };
    }

    // Update last login
    await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user.id);

    await logAudit(user.id, 'LOGIN', 'user', user.id, null, ip);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
        countryId: user.country_id,
        campaignId: user.campaign_id,
      },
    };
  }

  async refreshAccessToken(refreshTokenValue: string) {
    const tokenHash = crypto.createHash('sha256').update(refreshTokenValue).digest('hex');

    const result = await query(
      `SELECT rt.id, rt.user_id, rt.expires_at, rt.revoked,
              u.username, u.is_active, u.country_id, u.campaign_id, r.name as role
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       JOIN roles r ON r.id = u.role_id
       WHERE rt.token_hash = $1`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      throw { status: 401, code: 'INVALID_TOKEN', message: 'Refresh token inválido' };
    }

    const token = result.rows[0];

    if (token.revoked) {
      throw { status: 401, code: 'TOKEN_REVOKED', message: 'Refresh token ha sido revocado' };
    }

    if (new Date(token.expires_at) < new Date()) {
      throw { status: 401, code: 'TOKEN_EXPIRED', message: 'Refresh token ha expirado' };
    }

    if (!token.is_active) {
      throw { status: 403, code: 'ACCOUNT_DISABLED', message: 'La cuenta está desactivada' };
    }

    // Revoke old refresh token
    await query('UPDATE refresh_tokens SET revoked = TRUE WHERE id = $1', [token.id]);

    // Issue new tokens
    const user = {
      id: token.user_id,
      username: token.username,
      role: token.role,
      country_id: token.country_id,
      campaign_id: token.campaign_id,
    };

    const accessToken = this.generateAccessToken(user);
    const newRefreshToken = await this.generateRefreshToken(token.user_id);

    return { accessToken, refreshToken: newRefreshToken };
  }

  async logout(refreshTokenValue: string) {
    const tokenHash = crypto.createHash('sha256').update(refreshTokenValue).digest('hex');
    await query('UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1', [tokenHash]);
  }

  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    const result = await query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) {
      throw { status: 404, code: 'USER_NOT_FOUND', message: 'Usuario no encontrado' };
    }

    const isValid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!isValid) {
      throw { status: 401, code: 'INVALID_PASSWORD', message: 'Contraseña actual incorrecta' };
    }

    if (newPassword.length < 8) {
      throw { status: 400, code: 'WEAK_PASSWORD', message: 'La contraseña debe tener al menos 8 caracteres' };
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, userId]);

    // Revoke all refresh tokens for this user
    await query('UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1', [userId]);

    await logAudit(userId, 'PASSWORD_CHANGED', 'user', userId);
  }

  async getProfile(userId: number) {
    const result = await query(
      `SELECT u.id, u.username, u.email, u.full_name, u.is_active,
              u.country_id, u.campaign_id, u.last_login_at,
              r.name as role, c.name as country_name, camp.name as campaign_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN countries c ON c.id = u.country_id
       LEFT JOIN campaigns camp ON camp.id = u.campaign_id
       WHERE u.id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw { status: 404, code: 'USER_NOT_FOUND', message: 'Usuario no encontrado' };
    }

    return result.rows[0];
  }

  private generateAccessToken(user: any): string {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      countryId: user.country_id || null,
      campaignId: user.campaign_id || null,
    };
    return jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn as any });
  }

  private async generateRefreshToken(userId: number): Promise<string> {
    const tokenValue = crypto.randomBytes(64).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(tokenValue).digest('hex');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [userId, tokenHash, expiresAt]
    );

    return tokenValue;
  }
}

export const authService = new AuthService();
