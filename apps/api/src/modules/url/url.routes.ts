import { Router } from 'express';
import { UrlController } from './url.controller';
import { UrlService } from './url.service';
import { UrlRepository } from './url.repository';
import { cacheService } from '../../infrastructure/cache/redisClient';
import { authMiddleware, optionalAuthMiddleware } from '../../middleware/auth.middleware';
import { rateLimiter } from '../../middleware/rateLimiter.middleware';
import { validateRequest } from '../../middleware/validateRequest.middleware';
import { createUrlSchema, getUrlParamsSchema, updateUrlSchema, listUrlsSchema } from './url.schema';
import { config } from '../../config';

// ─── Dependency Injection (Manual Wiring) ───
const urlRepository = new UrlRepository();
const urlService = new UrlService(urlRepository, cacheService);
const urlController = new UrlController(urlService);

// ─── API Routes (/api/v1/urls) ───
export const urlApiRouter: Router = Router();

// Create short URL (rate limited, optional auth)
urlApiRouter.post(
    '/',
    optionalAuthMiddleware,
    rateLimiter(config.rateLimit.maxRequests, config.rateLimit.windowSeconds),
    validateRequest(createUrlSchema),
    urlController.create,
);

// List user's URLs (authenticated, paginated)
urlApiRouter.get(
    '/',
    authMiddleware,
    validateRequest(listUrlsSchema),
    urlController.list,
);

// Get URL details (authenticated)
urlApiRouter.get(
    '/:code',
    authMiddleware,
    validateRequest(getUrlParamsSchema),
    urlController.getByCode,
);

// Update URL (authenticated)
urlApiRouter.patch(
    '/:code',
    authMiddleware,
    validateRequest(updateUrlSchema),
    urlController.update,
);

// Delete URL (authenticated)
urlApiRouter.delete(
    '/:code',
    authMiddleware,
    validateRequest(getUrlParamsSchema),
    urlController.delete,
);

// ─── Redirect Route (mounted at root level) ───
export const redirectRouter: Router = Router();

redirectRouter.get(
    '/:code',
    validateRequest(getUrlParamsSchema),
    urlController.redirect,
);
