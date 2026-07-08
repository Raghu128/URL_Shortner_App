import { Url } from '@prisma/client';
import { UrlRepository } from './url.repository';
import { CreateUrlDto, UpdateUrlDto } from './url.types';
import { CacheService } from '../../infrastructure/cache/redisClient';
import { encodeToBase62 } from '../../common/utils/hashGenerator';
import { validateUrl } from '../../common/utils/urlValidator';
import { ConflictError, NotFoundError, ValidationError } from '../../common/errors';
import { CACHE_KEYS, CACHE_TTL } from '../../common/constants';
import { logger } from '../../config/logger';
import { publishSafetyScanJob } from '../../infrastructure/queue/publisher';
import { v4 as uuidv4 } from 'uuid';
import { prismaWrite } from '../../infrastructure/database/prismaClient';

/**
 * URL Service — Business logic layer.
 *
 * Orchestrates between repository, cache, and utilities.
 * Contains no HTTP or framework-specific code.
 */
export class UrlService {
    constructor(
        private readonly urlRepository: UrlRepository,
        private readonly cache: CacheService,
    ) { }

    /**
     * Create a new short URL.
     *
     * Steps:
     * 1. Validate the original URL
     * 2. Handle custom alias (check uniqueness) or generate a Base62 code
     * 3. Persist to primary database
     * 4. Cache the mapping in Redis
     */
    async createShortUrl(dto: CreateUrlDto): Promise<Url> {
        // 1. Validate URL format, protocol, domain blocklist (instant, no I/O)
        const validation = validateUrl(dto.originalUrl);
        if (!validation.valid) {
            throw new ValidationError(null, validation.reason);
        }

        // ─ Safety scan is ASYNC (zero latency added to this request) ──────────────────────
        // A scan job is published to RabbitMQ after creation.
        // The SafetyScanWorker calls Google Safe Browsing and deactivates
        // the URL if flagged — without any latency impact here.
        // ─────────────────────────────────────────────────────────────────

        // 2. Handle custom alias
        if (dto.customAlias) {
            const existing = await this.urlRepository.findByCode(dto.customAlias);
            if (existing) {
                throw new ConflictError(`Custom alias "${dto.customAlias}" is already taken`);
            }

            const url = await this.urlRepository.create({
                shortCode: dto.customAlias,
                originalUrl: dto.originalUrl,
                userId: dto.userId,
                isCustom: true,
                expiresAt: dto.expiresAt,
            });

            // DO NOT cache here — the SafetyScanWorker caches the URL only
            // after it passes the Google Safe Browsing check.
            // Caching before scan would let Redis hits bypass the scanStatus guard.

            // Fire-and-forget safety scan — zero latency added
            publishSafetyScanJob({ shortCode: url.shortCode, originalUrl: url.originalUrl });

            logger.info({ shortCode: url.shortCode, isCustom: true }, 'Short URL created (scan pending)');

            return url;
        }

        // 3. Auto-generate short code using Base62(auto-increment ID)
        //
        // Problem with naive 2-step approach (INSERT placeholder → UPDATE real code):
        //   - Window exists where record is in DB with invalid '_xxxxxxxx' short code
        //   - Server crash between the two calls = ORPHAN RECORD stuck in DB forever
        //   - Expiration worker could process the phantom placeholder record
        //
        // Fix: Prisma interactive transaction wraps both steps atomically.
        //   If the UPDATE fails for any reason, the INSERT is automatically rolled back.
        //   No orphan records can ever exist.
        const finalUrl = await prismaWrite.$transaction(async (tx) => {
            // Step A: INSERT with a unique temporary placeholder to get the auto-increment ID
            const placeholder = `_${uuidv4().slice(0, 8)}`;

            const created = await tx.url.create({
                data: {
                    shortCode: placeholder,
                    originalUrl: dto.originalUrl,
                    userId: dto.userId ?? null,
                    expiresAt: dto.expiresAt ?? null,
                },
            });

            // Step B: Encode the real ID to Base62 and update — all inside the same transaction
            const shortCode = encodeToBase62(created.id);

            return tx.url.update({
                where: { id: created.id },
                data: { shortCode },
            });
        });

        const shortCode = finalUrl.shortCode;

        // DO NOT cache here — the SafetyScanWorker caches the URL only
        // after it passes the Google Safe Browsing check.
        // Caching before scan would let Redis hits bypass the scanStatus guard.

        // Fire-and-forget safety scan — zero latency added
        publishSafetyScanJob({ shortCode, originalUrl: dto.originalUrl });

        logger.info({ shortCode, id: Number(finalUrl.id) }, 'Short URL created (scan pending)');

        return finalUrl;
    }

    /**
     * Resolve a short code to the original URL.
     *
     * Three-tier read strategy:
     * 1. Redis cache (sub-ms)
     * 2. Read replica (~5ms)
     * 3. Primary fallback (~10ms, for replication lag)
     */
    async resolveUrl(shortCode: string): Promise<string> {
        // Tier 1: Cache lookup
        // NOTE: Cached entries are always safe — the SafetyScanWorker evicts
        //       unsafe URLs from Redis immediately after flagging them.
        const cached = await this.cache.get(`${CACHE_KEYS.URL_PREFIX}${shortCode}`);
        if (cached) {
            return cached;
        }

        // Tier 2: Read replica
        let url = await this.urlRepository.findByCode(shortCode);

        // Tier 3: Primary fallback (replication lag edge case)
        if (!url) {
            url = await this.urlRepository.findByCodeFromPrimary(shortCode);
        }

        if (!url || !url.isActive) {
            throw new NotFoundError('Short URL not found');
        }

        // Check expiration
        if (url.expiresAt && url.expiresAt < new Date()) {
            throw new NotFoundError('Short URL has expired');
        }

        // Safety scan check — only reached on cache miss (rare after warm-up).
        // Blocks redirects during the brief window between creation and scan completion.
        // 'unsafe' URLs are also caught here as a second line of defense (isActive
        // check above catches them first, but this is defence-in-depth).
        if (url.scanStatus === 'pending') {
            throw new NotFoundError('This URL is being verified. Please try again in a moment.');
        }
        if (url.scanStatus === 'unsafe') {
            throw new NotFoundError('Short URL not found'); // Don't reveal reason
        }

        // Populate cache for next request
        await this.cacheUrl(shortCode, url.originalUrl);

        return url.originalUrl;
    }

    /**
     * Get URL details by short code (for dashboard/API).
     */
    async getUrlByCode(shortCode: string): Promise<Url> {
        const url = await this.urlRepository.findByCode(shortCode);
        if (!url || !url.isActive) {
            throw new NotFoundError('Short URL not found');
        }
        return url;
    }

    /**
     * List all URLs belonging to a user (paginated).
     */
    async getUrlsByUser(
        userId: bigint,
        page: number,
        limit: number,
    ): Promise<{ urls: Url[]; total: number }> {
        const [urls, total] = await Promise.all([
            this.urlRepository.findByUserId(userId, page, limit),
            this.urlRepository.countByUserId(userId),
        ]);

        return { urls, total };
    }

    /**
     * Update a URL's properties.
     */
    async updateUrl(shortCode: string, userId: bigint, dto: UpdateUrlDto): Promise<Url> {
        const url = await this.urlRepository.findByCode(shortCode);

        if (!url) {
            throw new NotFoundError('Short URL not found');
        }

        if (url.userId !== userId) {
            throw new NotFoundError('Short URL not found'); // Don't reveal it exists
        }

        const updated = await this.urlRepository.update(shortCode, dto);

        // Invalidate cache if URL was deactivated
        if (dto.isActive === false) {
            await this.cache.del(`${CACHE_KEYS.URL_PREFIX}${shortCode}`);
        }

        return updated;
    }

    /**
     * Soft-delete a URL.
     */
    async deleteUrl(shortCode: string, userId: bigint): Promise<void> {
        const url = await this.urlRepository.findByCode(shortCode);

        if (!url) {
            throw new NotFoundError('Short URL not found');
        }

        if (url.userId !== userId) {
            throw new NotFoundError('Short URL not found');
        }

        await this.urlRepository.softDelete(shortCode);

        // Invalidate cache
        await this.cache.del(`${CACHE_KEYS.URL_PREFIX}${shortCode}`);
        logger.info({ shortCode }, 'Short URL deleted');
    }

    // ─── Private Helpers ───

    /**
     * Cache a URL mapping with standard TTL.
     */
    private async cacheUrl(shortCode: string, originalUrl: string): Promise<void> {
        try {
            await this.cache.set(
                `${CACHE_KEYS.URL_PREFIX}${shortCode}`,
                originalUrl,
                CACHE_TTL.URL_MAPPING,
            );
        } catch (error) {
            // Cache failure is non-critical — log and continue
            logger.warn({ error, shortCode }, 'Failed to cache URL mapping');
        }
    }

    // updateShortCode() was removed — the two-step CREATE+UPDATE is now a single
    // Prisma $transaction in createShortUrl(), which eliminates the orphan record window.
}
