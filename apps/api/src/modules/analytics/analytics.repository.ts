import { prismaRead } from '../../infrastructure/database/prismaClient';
import { UrlRepository } from '../url/url.repository';

/**
 * Analytics Repository.
 *
 * In a full production system, this would read from ClickHouse.
 * For now, we use the Postgres click_count and the URL table.
 * The architecture supports swapping this to ClickHouse without
 * changing the service layer (Repository Pattern / DIP).
 */
export class AnalyticsRepository {
    constructor(private readonly urlRepository: UrlRepository) { }

    /**
     * Get click count for a URL (from Postgres denormalized counter).
     * In production, this would query ClickHouse for detailed analytics.
     */
    async getClickCount(shortCode: string): Promise<number> {
        const url = await prismaRead.url.findUnique({
            where: { shortCode },
            select: { clickCount: true },
        });

        return url ? Number(url.clickCount) : 0;
    }

    /**
     * Get summary analytics for a URL.
     * Placeholder — in production, aggregates from ClickHouse.
     */
    async getSummary(shortCode: string): Promise<{
        totalClicks: number;
        createdAt: Date | null;
    }> {
        const url = await prismaRead.url.findUnique({
            where: { shortCode },
            select: { clickCount: true, createdAt: true },
        });

        return {
            totalClicks: url ? Number(url.clickCount) : 0,
            createdAt: url?.createdAt || null,
        };
    }
}
