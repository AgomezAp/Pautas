import Redis from 'ioredis';
import { env } from './environment';
import { logger } from '../utils/logger.util';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis | null {
  return redisClient;
}

export async function initRedis(): Promise<void> {
  if (!env.redis.enabled) {
    logger.info('Redis disabled by configuration, using in-memory cache fallback');
    return;
  }

  try {
    const client = new Redis({
      host: env.redis.host,
      port: env.redis.port,
      password: env.redis.password || undefined,
      db: env.redis.db,
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,
      retryStrategy(times: number) {
        if (times > 3) {
          return null;
        }
        return Math.min(times * 500, 3000);
      },
      lazyConnect: true,
    });

    client.on('connect', () => {
      logger.info('Redis connected');
    });

    let errorLogged = false;
    client.on('error', (err) => {
      if (!errorLogged) {
        logger.warn(`Redis unavailable: ${err.message}. Using in-memory cache fallback.`);
        errorLogged = true;
      }
    });

    client.on('close', () => {
      // Silent — avoid log spam when Redis is not installed
    });

    await client.connect();
    redisClient = client;
    logger.info('Redis connection established successfully');
  } catch (err: any) {
    redisClient = null;
    logger.info(`Redis not available (${err.message}). Using in-memory cache — this is fine for development.`);
  }
}
