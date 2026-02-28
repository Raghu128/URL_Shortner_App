import { Router } from 'express';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsRepository } from './analytics.repository';
import { UrlRepository } from '../url/url.repository';
import { authMiddleware } from '../../middleware/auth.middleware';

// ─── Dependency Injection ───
const urlRepository = new UrlRepository();
const analyticsRepository = new AnalyticsRepository(urlRepository);
const analyticsService = new AnalyticsService(analyticsRepository);
const analyticsController = new AnalyticsController(analyticsService);

// ─── Routes (/api/v1/analytics) ───
export const analyticsRouter: Router = Router();

analyticsRouter.get(
    '/:code',
    authMiddleware,
    analyticsController.getAnalytics,
);
