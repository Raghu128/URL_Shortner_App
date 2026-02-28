import Redis from 'ioredis';
import { config } from '../../config';
import { logger } from '../../config/logger';

/**
 * Redis client for caching URL mappings and rate limiting.
 * Uses ioredis for cluster support and automatic reconnection.
 */
export const redisClient = new Redis(config.redis.url, {
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
        const delay = Math.min(times * 200, 5000);
        logger.warn({ attempt: times, delayMs: delay }, 'Redis reconnecting...');
        return delay;
    },
    lazyConnect: true, // Don't connect until explicitly called
});

redisClient.on('error', (error) => {
    logger.error({ error }, 'Redis connection error');
});

redisClient.on('connect', () => {
    logger.info('✅ Connected to Redis');
});

/**
 * Cache wrapper with typed get/set operations.
 * Encapsulates Redis operations behind a clean interface.
 */
export class CacheService {
    constructor(private readonly redis: Redis) { }

    /**
     * Get a cached value by key.
     */
    async get(key: string): Promise<string | null> {
        return this.redis.get(key);
    }

    /**
     * Set a value with TTL (in seconds).
     */
    async set(key: string, value: string, ttlSeconds: number): Promise<void> {
        await this.redis.set(key, value, 'EX', ttlSeconds);
    }

    /**
     * Delete a key (cache invalidation).
     */
    async del(key: string): Promise<void> {
        await this.redis.del(key);
    }

    /**
     * Increment a counter (used for rate limiting).
     * Returns the new count after increment.
     */
    async incr(key: string): Promise<number> {
        return this.redis.incr(key);
    }

    /**
     * Set TTL on an existing key.
     */
    async expire(key: string, ttlSeconds: number): Promise<void> {
        await this.redis.expire(key, ttlSeconds);
    }

    /**
     * Check if Redis is connected and responding.
     */
    async ping(): Promise<boolean> {
        try {
            const result = await this.redis.ping();
            return result === 'PONG';
        } catch {
            return false;
        }
    }
}

/** Singleton cache service instance */
export const cacheService = new CacheService(redisClient);

/**
 * Connect Redis client.
 * Called once at server startup.
 */
export async function connectRedis(): Promise<void> {
    try {
        await redisClient.connect();
    } catch (error) {
        logger.error({ error }, '❌ Failed to connect to Redis');
        throw error;
    }
}

/**
 * Disconnect Redis client.
 * Called during graceful shutdown.
 */
export async function disconnectRedis(): Promise<void> {
    await redisClient.quit();
    logger.info('Redis connection closed');
}
