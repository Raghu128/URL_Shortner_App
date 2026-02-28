import { AnalyticsRepository } from './analytics.repository';
import { publishClickEvent } from '../../infrastructure/queue/publisher';
import { NotFoundError } from '../../common/errors';
import { ClickEventPayload } from '../../common/types';

/**
 * Analytics Service.
 *
 * - trackClick: Publishes click events to RabbitMQ (async, fire-and-forget)
 * - getAnalytics: Reads analytics data from the repository
 */
export class AnalyticsService {
    constructor(private readonly analyticsRepository: AnalyticsRepository) { }

    /**
     * Track a click event by publishing to the message queue.
     * This is fire-and-forget — failure never blocks the redirect.
     */
    trackClick(event: ClickEventPayload): void {
        publishClickEvent(event);
    }

    /**
     * Get analytics summary for a short code.
     */
    async getAnalytics(shortCode: string) {
        const summary = await this.analyticsRepository.getSummary(shortCode);

        if (summary.createdAt === null) {
            throw new NotFoundError('Short URL not found');
        }

        return {
            shortCode,
            totalClicks: summary.totalClicks,
            createdAt: summary.createdAt,
        };
    }
}
