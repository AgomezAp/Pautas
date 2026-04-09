import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cron from 'node-cron';
import { env } from './config/environment';
import { logger } from './utils/logger';
import { googleAdsRoutes } from './routes/google-ads.routes';
import { persistenceService } from './services/persistence.service';

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: env.isProduction
    ? env.frontendUrl
    : [env.frontendUrl, 'http://localhost:4200', 'http://localhost:4201'],
  credentials: true,
}));
app.use(express.json());

// Routes
app.use('/api/google-ads', googleAdsRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(env.port, () => {
  logger.info(`Pautas Google Ads service running on port ${env.port}`);
  logger.info(`Environment: ${env.nodeEnv}`);

  // Cron: sync campaigns + snapshots every hour
  cron.schedule('0 * * * *', async () => {
    logger.info('[CRON] Hourly campaign sync (active only)');
    try {
      const result = await persistenceService.persistCampaigns(true);
      logger.info(`[CRON] Synced ${result.campaigns} campaigns, ${result.snapshots} snapshots`);
    } catch (error: any) {
      logger.error(`[CRON] Hourly sync failed: ${error.message}`);
    }
  });

  // Cron: full sync daily at 3 AM
  cron.schedule('0 3 * * *', async () => {
    logger.info('[CRON] Daily full sync & persist');
    try {
      const results = await persistenceService.syncAll();
      logger.info(`[CRON] Full sync completed: ${JSON.stringify(results)}`);
    } catch (error: any) {
      logger.error(`[CRON] Full sync failed: ${error.message}`);
    }
  });

  logger.info('Cron jobs registered');
});

export default app;
