import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import path from 'path';
import jwt from 'jsonwebtoken';
import http from 'http';
import { env } from './config/environment';
import { corsOptions } from './config/cors.config';
import { logger } from './utils/logger.util';
import { errorHandler } from './middleware/error-handler.middleware';
import { authRoutes } from './modules/auth/auth.routes';
import { adminRoutes } from './modules/admin/admin.routes';
import { conglomeradoRoutes } from './modules/conglomerado/conglomerado.routes';
import { pautadoresRoutes } from './modules/pautadores/pautadores.routes';
import { gestionRoutes } from './modules/gestion/gestion.routes';
import { systemRoutes } from './modules/system/system.routes';
import { googleAdsRoutes } from './modules/google-ads/google-ads.routes';
import { alertsRoutes } from './modules/alerts/alerts.routes';
import { registerCronJobs } from './jobs/cron';
import { initRedis } from './config/redis';
import { cacheService } from './services/cache.service';
import { websocketService } from './services/websocket.service';

const app = express();

// Global middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static file serving for uploads (protected with auth)
app.use('/uploads', (req, res, next) => {
  // Check Authorization header
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  // Fallback: check query parameter (for img src tags that can't set headers)
  if (!token && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Token de acceso requerido' });
  }

  try {
    jwt.verify(token, env.jwt.secret);
    next();
  } catch {
    return res.status(401).json({ error: 'INVALID_TOKEN', message: 'Token inválido' });
  }
}, express.static(path.resolve(env.upload.dir)));

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/conglomerado', conglomeradoRoutes);
app.use('/api/v1/pautadores', pautadoresRoutes);
app.use('/api/v1/gestion', gestionRoutes);
app.use('/api/v1/system', systemRoutes);
app.use('/api/v1/google-ads', googleAdsRoutes);
app.use('/api/v1/alerts', alertsRoutes);

// Health check
app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), cache: cacheService.getStats() });
});

// Global error handler
app.use(errorHandler);

// Create HTTP server and initialize WebSocket
const httpServer = http.createServer(app);
websocketService.initialize(httpServer);

// Start server
httpServer.listen(env.port, async () => {
  logger.info(`Server running on port ${env.port} in ${env.nodeEnv} mode`);
  await initRedis();
  registerCronJobs();
});

export default app;
