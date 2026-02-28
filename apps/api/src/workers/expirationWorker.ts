import { UrlRepository } from '../modules/url/url.repository';
import { CacheService } from '../infrastructure/cache/redisClient';
import { cacheService } from '../infrastructure/cache/redisClient';
import { CACHE_KEYS } from '../common/constants';
import { logger } from '../config/logger';

/**
 * Expiration Worker — Background cron job.
 *
 * Periodically scans for expired URLs and:
 * 1. Soft-deletes them in Postgres (PRIMARY)
 * 2. Invalidates their Redis cache entries
 *
 * Runs on a configurable interval (default: every 60 seconds).
 */
export class ExpirationWorker {
    private urlRepository: UrlRepository;
    private cache: CacheService;
    private interval: NodeJS.Timeout | null = null;

    constructor() {
        this.urlRepository = new UrlRepository();
        this.cache = cacheService;
    }

    /**
     * Start the expiration check loop.
     */
    start(intervalMs: number = 60_000): void {
        logger.info({ intervalMs }, 'Starting expiration worker...');

        // Run immediately, then on interval
        this.processExpiredUrls();

        this.interval = setInterval(() => {
            this.processExpiredUrls();
        }, intervalMs);
    }

    /**
     * Find and deactivate expired URLs.
     */
    private async processExpiredUrls(): Promise<void> {
        try {
            const expiredUrls = await this.urlRepository.findExpired(100);

            if (expiredUrls.length === 0) return;

            const shortCodes = expiredUrls.map((u) => u.shortCode);

            // Bulk deactivate in Postgres PRIMARY
            const count = await this.urlRepository.bulkDeactivate(shortCodes);

            // Invalidate each from Redis cache
            for (const code of shortCodes) {
                await this.cache.del(`${CACHE_KEYS.URL_PREFIX}${code}`);
            }

            logger.info({ count, codes: shortCodes }, 'Expired URLs deactivated');
        } catch (error) {
            logger.error({ error }, 'Expiration worker error');
        }
    }

    /**
     * Stop the worker.
     */
    stop(): void {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        logger.info('Expiration worker stopped');
    }
}
