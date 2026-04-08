import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger.util';

interface MemoryCacheEntry {
  value: string;
  expiresAt: number;
}

class CacheService {
  private memoryCache: Map<string, MemoryCacheEntry> = new Map();
  private cleanupTimer: NodeJS.Timeout | null = null;
  private readonly MAX_MEMORY_ENTRIES = 10000;

  constructor() {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.memoryCache) {
        if (now > entry.expiresAt) this.memoryCache.delete(key);
      }
    }, 60_000);
    if (this.cleanupTimer.unref) this.cleanupTimer.unref();
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const redis = getRedisClient();
      if (redis && redis.status === 'ready') {
        const raw = await redis.get(key);
        if (raw === null) return null;
        return JSON.parse(raw) as T;
      }
      return this.memoryGet<T>(key);
    } catch (err: any) {
      logger.debug(`Cache get error [${key}]: ${err.message}`);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      const redis = getRedisClient();
      if (redis && redis.status === 'ready') {
        await redis.set(key, serialized, 'EX', ttlSeconds);
        return;
      }
      this.memorySet(key, serialized, ttlSeconds);
    } catch (err: any) {
      logger.debug(`Cache set error [${key}]: ${err.message}`);
    }
  }

  async del(key: string): Promise<void> {
    try {
      const redis = getRedisClient();
      if (redis && redis.status === 'ready') {
        await redis.del(key);
        return;
      }
      this.memoryCache.delete(key);
    } catch (err: any) {
      logger.debug(`Cache del error [${key}]: ${err.message}`);
    }
  }

  async invalidatePattern(pattern: string): Promise<number> {
    try {
      const redis = getRedisClient();
      if (redis && redis.status === 'ready') {
        let deleted = 0;
        const stream = redis.scanStream({ match: pattern, count: 100 });
        return new Promise((resolve) => {
          stream.on('data', (keys: string[]) => {
            if (keys.length > 0) {
              deleted += keys.length;
              redis.del(...keys).catch(() => {});
            }
          });
          stream.on('end', () => resolve(deleted));
          stream.on('error', () => resolve(deleted));
        });
      }

      const regex = this.globToRegex(pattern);
      let deleted = 0;
      for (const key of this.memoryCache.keys()) {
        if (regex.test(key)) {
          this.memoryCache.delete(key);
          deleted++;
        }
      }
      return deleted;
    } catch (err: any) {
      logger.debug(`Cache invalidate error [${pattern}]: ${err.message}`);
      return 0;
    }
  }

  getStats(): { backend: 'redis' | 'memory'; memorySize: number } {
    const redis = getRedisClient();
    return {
      backend: redis && redis.status === 'ready' ? 'redis' : 'memory',
      memorySize: this.memoryCache.size,
    };
  }

  private memoryGet<T>(key: string): T | null {
    const entry = this.memoryCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.memoryCache.delete(key);
      return null;
    }
    return JSON.parse(entry.value) as T;
  }

  private memorySet(key: string, serialized: string, ttlSeconds: number): void {
    if (this.memoryCache.size >= this.MAX_MEMORY_ENTRIES) {
      this.memoryCache.clear();
    }
    this.memoryCache.set(key, {
      value: serialized,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  private globToRegex(pattern: string): RegExp {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp('^' + escaped.replace(/\*/g, '.*') + '$');
  }
}

export const cacheService = new CacheService();
