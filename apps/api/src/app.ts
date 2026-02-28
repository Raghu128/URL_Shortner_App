import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { requestLogger } from './middleware/requestLogger.middleware';
import { errorHandler } from './middleware/errorHandler.middleware';
import { urlApiRouter, redirectRouter } from './modules/url/url.routes';
import { authRouter } from './modules/auth/auth.routes';
import { analyticsRouter } from './modules/analytics/analytics.routes';
import { cacheService } from './infrastructure/cache/redisClient';
import { prismaRead } from './infrastructure/database/prismaClient';
import { logger } from './config/logger';

/**
 * Create and configure the Express application.
 *
 * Middleware order matters:
 * 1. Security headers (Helmet)
 * 2. CORS
 * 3. Body parsing
 * 4. Request logging
 * 5. Routes
 * 6. Error handler (MUST be last)
 */
export function createApp(): express.Application {
    const app = express();

    // ─── Global Middleware ───

    // Security headers
    app.set('trust proxy', 1); // Trust first proxy (for rate limiter IP extraction)
    app.use(helmet());

    // CORS
    app.use(
        cors({
            origin: config.cors.origin,
            methods: ['GET', 'POST', 'PATCH', 'DELETE'],
            allowedHeaders: ['Content-Type', 'Authorization'],
            maxAge: 86400, // 24h preflight cache
        }),
    );

    // Body parsing (small limit since we only accept short payloads)
    app.use(express.json({ limit: '1kb' }));
    app.use(express.urlencoded({ extended: false, limit: '1kb' }));

    // Request logging
    app.use(requestLogger);

    // ─── Health Check ───
    app.get('/health', async (_req, res) => {
        try {
            const dbHealthy = await checkDatabaseHealth();
            const cacheHealthy = await cacheService.ping();

            const isHealthy = dbHealthy && cacheHealthy;

            res.status(isHealthy ? 200 : 503).json({
                status: isHealthy ? 'healthy' : 'degraded',
                uptime: process.uptime(),
                timestamp: new Date().toISOString(),
                checks: {
                    database: dbHealthy ? 'connected' : 'disconnected',
                    cache: cacheHealthy ? 'connected' : 'disconnected',
                },
            });
        } catch (error) {
            logger.error({ error }, 'Health check failed');
            res.status(503).json({
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
            });
        }
    });

    // ─── API Routes ───
    app.use('/api/v1/urls', urlApiRouter);
    app.use('/api/v1/auth', authRouter);
    app.use('/api/v1/analytics', analyticsRouter);

    // ─── Redirect Route (root level — must be AFTER /api routes) ───
    app.use('/', redirectRouter);

    // ─── 404 Handler ───
    app.use((_req, res) => {
        res.status(404).json({
            success: false,
            error: {
                message: 'Endpoint not found',
                code: 404,
            },
        });
    });

    // ─── Global Error Handler (MUST be last) ───
    app.use(errorHandler);

    return app;
}

/**
 * Check if the database (read replica) is reachable.
 */
async function checkDatabaseHealth(): Promise<boolean> {
    try {
        await prismaRead.$queryRaw`SELECT 1`;
        return true;
    } catch {
        return false;
    }
}
