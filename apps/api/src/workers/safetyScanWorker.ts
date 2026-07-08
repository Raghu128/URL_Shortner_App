import { QueueConsumer } from '../infrastructure/queue/consumer';
import { CacheService } from '../infrastructure/cache/redisClient';
import { cacheService } from '../infrastructure/cache/redisClient';
import { checkUrlSafety } from '../common/utils/urlValidator';
import { CACHE_KEYS, CACHE_TTL } from '../common/constants';
import { config } from '../config';
import { logger } from '../config/logger';
import { prismaWrite } from '../infrastructure/database/prismaClient';

/**
 * SafetyScanWorker — Background process.
 *
 * Flow (ZERO latency on URL creation, ZERO bypass via Redis):
 *   1. User POSTs a URL → stored in DB immediately (NOT cached) → short URL returned
 *   2. A scan job is published to `url_safety_scan` queue (fire-and-forget)
 *   3. This worker calls Google Safe Browsing API
 *   4. If SAFE   → update scanStatus='safe' + NOW populate Redis cache
 *   5. If UNSAFE → mark isActive=false + scanStatus='unsafe' (never cached)
 *
 * Why cache AFTER scan (not at creation)?
 *   Redis cache hits bypass all scanStatus checks in resolveUrl().
 *   If we cached before scanning, a malicious URL would be serveable
 *   from cache during the scan window with no way to intercept it.
 *   By caching ONLY after a safe verdict, we guarantee:
 *   - Pending URLs: cache miss → DB lookup → scanStatus='pending' → 404
 *   - Unsafe URLs:  cache miss → DB lookup → scanStatus='unsafe'  → 404
 *   - Safe URLs:    cache hit  → instant redirect ✅
 */
export class SafetyScanWorker {
    private consumer: QueueConsumer;
    private cache: CacheService;

    constructor() {
        this.consumer = new QueueConsumer();
        this.cache = cacheService;
    }

    /**
     * Start consuming scan jobs from RabbitMQ.
     */
    async start(): Promise<void> {
        logger.info('Starting SafetyScanWorker...');

        await this.consumer.consume(
            config.queue.safetyScanQueue,
            async (data) => {
                const shortCode = data.shortCode as string;
                const originalUrl = data.originalUrl as string;

                if (!shortCode || !originalUrl) {
                    logger.warn({ data }, 'SafetyScanWorker: Invalid job payload, skipping');
                    return;
                }

                await this.scanUrl(shortCode, originalUrl);
            },
            5, // Process up to 5 scan jobs concurrently
        );
    }

    /**
     * Call Google Safe Browsing and update the URL record accordingly.
     */
    private async scanUrl(shortCode: string, originalUrl: string): Promise<void> {
        logger.debug({ shortCode, originalUrl }, 'Scanning URL for safety...');

        try {
            const safety = await checkUrlSafety(originalUrl);

            if (!safety.safe) {
                // ── UNSAFE: deactivate immediately ──────────────────────────
                logger.warn(
                    { shortCode, originalUrl, threat: safety.threat },
                    'URL flagged as unsafe — deactivating',
                );

                // Mark inactive + scanStatus=unsafe in Postgres
                await prismaWrite.url.update({
                    where: { shortCode },
                    data: {
                        isActive: false,
                        scanStatus: 'unsafe',
                    },
                });

                // Defense-in-depth: evict from cache (no-op since we never
                // cached it, but guards against any future code change)
                await this.cache.del(`${CACHE_KEYS.URL_PREFIX}${shortCode}`);

                logger.warn({ shortCode, threat: safety.threat }, 'Unsafe URL deactivated');
            } else {
                // ── SAFE: mark as scanned + NOW populate Redis cache ───────
                // We intentionally did NOT cache at creation time.
                // Caching here (after scan passes) guarantees that Redis hits
                // can only ever serve verified-safe URLs.
                await prismaWrite.url.update({
                    where: { shortCode },
                    data: { scanStatus: 'safe' },
                });

                // Populate Redis cache now that the URL is verified safe
                await this.cache.set(
                    `${CACHE_KEYS.URL_PREFIX}${shortCode}`,
                    originalUrl,
                    CACHE_TTL.URL_MAPPING,
                );

                logger.info({ shortCode }, 'URL passed safety scan — cached and ready');
            }
        } catch (error) {
            // Log but don't rethrow — a scan error should not deactivate the URL
            logger.error({ error, shortCode }, 'SafetyScanWorker: Error during scan');
        }
    }

    /**
     * Gracefully stop the worker.
     */
    async stop(): Promise<void> {
        await this.consumer.close();
        logger.info('SafetyScanWorker stopped');
    }
}

// ─── Run as standalone process ───────────────────────────────────────────────
if (require.main === module) {
    const worker = new SafetyScanWorker();

    worker.start().catch((error) => {
        logger.error({ error }, 'SafetyScanWorker failed to start');
        process.exit(1);
    });

    process.on('SIGTERM', async () => {
        await worker.stop();
        process.exit(0);
    });

    process.on('SIGINT', async () => {
        await worker.stop();
        process.exit(0);
    });
}
