import { Request } from 'express';

/**
 * Authenticated request — has a decoded user payload attached by auth middleware.
 */
export interface AuthenticatedRequest extends Request {
    user?: {
        userId: bigint;
        email: string;
        tier: string;
    };
}

/**
 * Click event data pushed to the analytics queue.
 */
export interface ClickEventPayload {
    shortCode: string;
    ipAddress: string;
    userAgent: string;
    referrer: string;
    clickedAt: string;
}

/**
 * Standard paginated query parameters.
 */
export interface PaginationParams {
    page: number;
    limit: number;
}
