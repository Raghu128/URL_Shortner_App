import { Request, Response, NextFunction } from 'express';
import { AnalyticsService } from './analytics.service';
import { sendSuccess } from '../../common/utils/responseHelper';
import { AuthenticatedRequest } from '../../common/types';

/**
 * Analytics Controller — HTTP layer for analytics endpoints.
 */
export class AnalyticsController {
    constructor(private readonly analyticsService: AnalyticsService) { }

    /**
     * GET /api/v1/analytics/:code — Get analytics for a short URL.
     * Only the owner of the URL can view its analytics.
     */
    getAnalytics = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const code = req.params.code as string;
            const analytics = await this.analyticsService.getAnalytics(code, req.user!.userId);
            sendSuccess(res, analytics);
        } catch (error) {
            next(error);
        }
    };
}
