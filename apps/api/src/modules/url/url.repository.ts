import { Url } from '@prisma/client';
import { prismaRead, prismaWrite } from '../../infrastructure/database/prismaClient';

/**
 * URL Repository — Data access layer.
 *
 * Implements read/write split:
 * - All reads → prismaRead (routed to replicas via PgBouncer)
 * - All writes → prismaWrite (routed to primary)
 * - findByCodeFromPrimary → emergency fallback for replication lag
 */
export class UrlRepository {
    // ═══════════════════════════════════════════
    //  READS → Replica (via PgBouncer)
    // ═══════════════════════════════════════════

    /**
     * Find a URL by its short code.
     * Primary lookup for redirect resolution — goes to READ REPLICA.
     */
    async findByCode(shortCode: string): Promise<Url | null> {
        return prismaRead.url.findUnique({
            where: { shortCode },
        });
    }

    /**
     * Find all URLs belonging to a specific user (paginated).
     * Used for the dashboard — goes to READ REPLICA.
     */
    async findByUserId(userId: bigint, page: number, limit: number): Promise<Url[]> {
        return prismaRead.url.findMany({
            where: { userId, isActive: true },
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Count total URLs belonging to a specific user.
     * Used for pagination — goes to READ REPLICA.
     */
    async countByUserId(userId: bigint): Promise<number> {
        return prismaRead.url.count({
            where: { userId, isActive: true },
        });
    }

    /**
     * Find URLs that have expired and are still marked active.
     * Used by the expiration worker — goes to READ REPLICA.
     */
    async findExpired(limit: number = 100): Promise<Url[]> {
        return prismaRead.url.findMany({
            where: {
                isActive: true,
                expiresAt: {
                    lt: new Date(),
                    not: null,
                },
            },
            take: limit,
        });
    }

    // ═══════════════════════════════════════════
    //  WRITES → Primary
    // ═══════════════════════════════════════════

    /**
     * Create a new URL mapping.
     * Always writes to PRIMARY.
     */
    async create(data: {
        shortCode: string;
        originalUrl: string;
        userId?: bigint;
        isCustom?: boolean;
        expiresAt?: Date;
    }): Promise<Url> {
        return prismaWrite.url.create({
            data: {
                shortCode: data.shortCode,
                originalUrl: data.originalUrl,
                userId: data.userId || null,
                isCustom: data.isCustom || false,
                expiresAt: data.expiresAt || null,
            },
        });
    }

    /**
     * Update an existing URL (toggle active, change expiry).
     * Always writes to PRIMARY.
     */
    async update(shortCode: string, data: { isActive?: boolean; expiresAt?: Date | null }): Promise<Url> {
        return prismaWrite.url.update({
            where: { shortCode },
            data,
        });
    }

    /**
     * Soft-delete a URL by marking it as inactive.
     * Always writes to PRIMARY.
     */
    async softDelete(shortCode: string): Promise<Url> {
        return prismaWrite.url.update({
            where: { shortCode },
            data: { isActive: false },
        });
    }

    /**
     * Bulk soft-delete expired URLs.
     * Used by the expiration worker — writes to PRIMARY.
     */
    async bulkDeactivate(shortCodes: string[]): Promise<number> {
        const result = await prismaWrite.url.updateMany({
            where: { shortCode: { in: shortCodes } },
            data: { isActive: false },
        });
        return result.count;
    }

    /**
     * Increment click count (denormalized counter).
     * Called in batches by the analytics worker — writes to PRIMARY.
     */
    async incrementClickCount(shortCode: string, increment: number = 1): Promise<void> {
        await prismaWrite.url.update({
            where: { shortCode },
            data: { clickCount: { increment } },
        });
    }

    // ═══════════════════════════════════════════
    //  PRIMARY FALLBACK (replication lag edge case)
    // ═══════════════════════════════════════════

    /**
     * Find a URL by code directly from the PRIMARY database.
     * Used as a fallback when a redirect lookup returns null from
     * the replica (could be replication lag on a just-created URL).
     */
    async findByCodeFromPrimary(shortCode: string): Promise<Url | null> {
        return prismaWrite.url.findUnique({
            where: { shortCode },
        });
    }
}
