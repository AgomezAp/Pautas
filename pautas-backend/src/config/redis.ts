import Redis from 'ioredis';
import { env } from './environment';
import { logger } from '../utils/logger.util';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis | null {
  return redisClient;
}

export function initRedis(): void {
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
      retryStrategy(times: number) {
        if (times > 10) {
          logger.warn('Redis: max retries reached, giving up reconnection');
          return null;
        }
        return Math.min(times * 200, 5000);
      },
      lazyConnect: true,
    });

    client.on('connect', () => {
      logger.info('Redis connected');
    });

    client.on('error', (err) => {
      logger.error(`Redis error: ${err.message}`);
    });

    client.on('close', () => {
      logger.warn('Redis connection closed');
    });

    client.connect().catch((err) => {
      logger.warn(`Redis initial connection failed: ${err.message}. Using in-memory fallback.`);
      redisClient = null;
    });

    redisClient = client;
  } catch (err: any) {
    logger.warn(`Redis init failed: ${err.message}. Using in-memory fallback.`);
  }
}
