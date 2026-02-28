import { Request, Response, NextFunction } from 'express';
import { cacheService } from '../infrastructure/cache/redisClient';
import { AppError } from '../common/errors';
import { CACHE_KEYS } from '../common/constants';
import { logger } from '../config/logger';

/**
 * Rate limiter middleware using Redis sliding window counter.
 *
 * How it works:
 * 1. Increment a per-IP counter in Redis
 * 2. If it's the first request, set TTL = windowSeconds
 * 3. If counter > maxRequests, reject with 429
 *
 * Rate limit headers are set on every response for client visibility.
 *
 * @param maxRequests - Maximum allowed requests in the window
 * @param windowSeconds - Time window in seconds
 */
export function rateLimiter(maxRequests: number, windowSeconds: number) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const ip = req.ip || req.socket.remoteAddress || 'unknown';
            const key = `${CACHE_KEYS.RATE_LIMIT_PREFIX}${ip}`;

            const current = await cacheService.incr(key);

            // Set TTL on first request in window
            if (current === 1) {
                await cacheService.expire(key, windowSeconds);
            }

            // Set rate limit headers
            res.setHeader('X-RateLimit-Limit', maxRequests);
            res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - current));
            res.setHeader('X-RateLimit-Reset', windowSeconds);

            if (current > maxRequests) {
                throw new AppError('Too many requests. Please try again later.', 429);
            }

            next();
        } catch (error) {
            if (error instanceof AppError) {
                next(error);
                return;
            }

            // If Redis is down, log warning but allow the request through
            // (fail-open for rate limiting — better than blocking all users)
            logger.warn({ error }, 'Rate limiter Redis error, allowing request');
            next();
        }
    };
}
