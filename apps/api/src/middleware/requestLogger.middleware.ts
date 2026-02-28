import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

/**
 * Request logging middleware using Pino.
 * Logs method, URL, status code, and response time for every request.
 *
 * Skips health check endpoint to avoid log noise.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
    // Skip logging for health checks
    if (req.path === '/health') {
        next();
        return;
    }

    const start = Date.now();

    // Log after response is finished
    res.on('finish', () => {
        const duration = Date.now() - start;

        const logData = {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            durationMs: duration,
            ip: req.ip,
            userAgent: req.get('user-agent'),
        };

        if (res.statusCode >= 500) {
            logger.error(logData, 'Request completed with server error');
        } else if (res.statusCode >= 400) {
            logger.warn(logData, 'Request completed with client error');
        } else {
            logger.info(logData, 'Request completed');
        }
    });

    next();
}
