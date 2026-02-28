import { Url } from '@prisma/client';
import { UrlRepository } from './url.repository';
import { CreateUrlDto, UpdateUrlDto } from './url.types';
import { CacheService } from '../../infrastructure/cache/redisClient';
import { encodeToBase62 } from '../../common/utils/hashGenerator';
import { validateUrl } from '../../common/utils/urlValidator';
import { ConflictError, NotFoundError, ValidationError } from '../../common/errors';
import { CACHE_KEYS, CACHE_TTL } from '../../common/constants';
import { logger } from '../../config/logger';

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
        // 1. Validate URL
        const validation = validateUrl(dto.originalUrl);
        if (!validation.valid) {
            throw new ValidationError(null, validation.reason);
        }

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

            // Cache immediately
            await this.cacheUrl(url.shortCode, url.originalUrl);
            logger.info({ shortCode: url.shortCode, isCustom: true }, 'Short URL created');

            return url;
        }

        // 3. Auto-generate short code using Base62(auto-increment ID)
        //    Strategy: Create the record first with a unique placeholder →
        //    encode the returned auto-increment ID as Base62 → update with final code.
        //    This guarantees zero collisions since each ID is unique.
        const { v4: uuidv4 } = require('uuid');
        const placeholder = `_${uuidv4().slice(0, 8)}`; // Unique temporary placeholder

        const url = await this.urlRepository.create({
            shortCode: placeholder,
            originalUrl: dto.originalUrl,
            userId: dto.userId,
            expiresAt: dto.expiresAt,
        });

        const shortCode = encodeToBase62(url.id);

        // Update with the real short code
        const finalUrl = await this.updateShortCode(url.id, shortCode);

        // Cache the new mapping
        await this.cacheUrl(shortCode, dto.originalUrl);
        logger.info({ shortCode, id: Number(url.id) }, 'Short URL created');

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

    /**
     * Update the short code for a URL record (used after Base62 encoding).
     * Direct prismaWrite since this is part of the create flow.
     */
    private async updateShortCode(id: bigint, shortCode: string): Promise<Url> {
        const { prismaWrite } = require('../../infrastructure/database/prismaClient');
        return prismaWrite.url.update({
            where: { id },
            data: { shortCode },
        });
    }
}
