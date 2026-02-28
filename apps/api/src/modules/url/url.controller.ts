import { Request, Response, NextFunction } from 'express';
import { UrlService } from './url.service';
import { toUrlResponse } from './url.types';
import { publishClickEvent } from '../../infrastructure/queue/publisher';
import { sendSuccess, sendCreated, sendPaginatedSuccess, sendNoContent } from '../../common/utils/responseHelper';
import { AuthenticatedRequest, ClickEventPayload } from '../../common/types';
import { PAGINATION } from '../../common/constants';
import { config } from '../../config';
import { logger } from '../../config/logger';

/**
 * URL Controller — HTTP layer.
 *
 * Responsibilities:
 * - Parse HTTP request (body, params, query)
 * - Call appropriate service method
 * - Return HTTP response
 *
 * Contains NO business logic.
 */
export class UrlController {
    constructor(private readonly urlService: UrlService) { }

    /**
     * POST /api/v1/urls — Create a new short URL.
     */
    create = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { url: originalUrl, customAlias, expiresAt } = req.body;

            const urlRecord = await this.urlService.createShortUrl({
                originalUrl,
                customAlias,
                expiresAt: expiresAt ? new Date(expiresAt) : undefined,
                userId: req.user?.userId,
            });

            sendCreated(res, toUrlResponse(urlRecord, config.baseUrl));
        } catch (error) {
            next(error);
        }
    };

    /**
     * GET /:code — Redirect to the original URL.
     * This is the HOT PATH — performance is critical.
     */
    redirect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const code = req.params.code as string;

            // Resolve URL (3-tier: Redis → Replica → Primary)
            const originalUrl = await this.urlService.resolveUrl(code);

            // Fire-and-forget analytics — NEVER block the redirect
            const clickEvent: ClickEventPayload = {
                shortCode: code,
                ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
                userAgent: req.get('user-agent') || '',
                referrer: req.get('referer') || req.get('referrer') || '',
                clickedAt: new Date().toISOString(),
            };

            // Publish to RabbitMQ asynchronously (don't await)
            try {
                publishClickEvent(clickEvent);
            } catch (analyticsError) {
                logger.error({ error: analyticsError }, 'Failed to publish click event');
                // Never fail the redirect because of analytics
            }

            // 302 Temporary Redirect — browser won't cache, so we get accurate analytics
            res.redirect(302, originalUrl);
        } catch (error) {
            next(error);
        }
    };

    /**
     * GET /api/v1/urls — List the authenticated user's URLs (paginated).
     */
    list = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const page = parseInt(req.query.page as string) || PAGINATION.DEFAULT_PAGE;
            const limit = Math.min(
                parseInt(req.query.limit as string) || PAGINATION.DEFAULT_LIMIT,
                PAGINATION.MAX_LIMIT,
            );

            const { urls, total } = await this.urlService.getUrlsByUser(req.user!.userId, page, limit);

            sendPaginatedSuccess(
                res,
                urls.map((u) => toUrlResponse(u, config.baseUrl)),
                {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            );
        } catch (error) {
            next(error);
        }
    };

    /**
     * GET /api/v1/urls/:code — Get URL details.
     */
    getByCode = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const code = req.params.code as string;
            const url = await this.urlService.getUrlByCode(code);
            sendSuccess(res, toUrlResponse(url, config.baseUrl));
        } catch (error) {
            next(error);
        }
    };

    /**
     * PATCH /api/v1/urls/:code — Update URL properties.
     */
    update = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const code = req.params.code as string;
            const { isActive, expiresAt } = req.body;

            const updated = await this.urlService.updateUrl(code, req.user!.userId, {
                isActive,
                expiresAt: expiresAt === null ? null : expiresAt ? new Date(expiresAt) : undefined,
            });

            sendSuccess(res, toUrlResponse(updated, config.baseUrl));
        } catch (error) {
            next(error);
        }
    };

    /**
     * DELETE /api/v1/urls/:code — Soft-delete a URL.
     */
    delete = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const code = req.params.code as string;
            await this.urlService.deleteUrl(code, req.user!.userId);
            sendNoContent(res);
        } catch (error) {
            next(error);
        }
    };
}
