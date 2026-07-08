import { AnalyticsRepository } from './analytics.repository';
import { publishClickEvent } from '../../infrastructure/queue/publisher';
import { NotFoundError } from '../../common/errors';
import { ClickEventPayload } from '../../common/types';
import { UrlRepository } from '../url/url.repository';

/**
 * Analytics Service.
 *
 * - trackClick: Publishes click events to RabbitMQ (async, fire-and-forget)
 * - getAnalytics: Reads analytics data from the repository (owner-only)
 */
export class AnalyticsService {
    constructor(
        private readonly analyticsRepository: AnalyticsRepository,
        private readonly urlRepository: UrlRepository,
    ) { }

    /**
     * Track a click event by publishing to the message queue.
     * This is fire-and-forget — failure never blocks the redirect.
     */
    trackClick(event: ClickEventPayload): void {
        publishClickEvent(event);
    }

    /**
     * Get analytics summary for a short code.
     * Only the owner of the URL can view its analytics (prevents IDOR).
     */
    async getAnalytics(shortCode: string, requestingUserId: bigint) {
        // Ownership check — fetch the URL and verify the requester owns it
        const url = await this.urlRepository.findByCode(shortCode);

        if (!url || url.userId !== requestingUserId) {
            // Don't reveal whether the URL exists — generic 404
            throw new NotFoundError('Short URL not found');
        }

        const summary = await this.analyticsRepository.getSummary(shortCode);

        return {
            shortCode,
            totalClicks: summary.totalClicks,
            createdAt: summary.createdAt,
        };
    }
}
