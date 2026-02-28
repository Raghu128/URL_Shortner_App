import pino from 'pino';
import { config } from './index';

/**
 * Structured logger using Pino.
 * - Development: Pretty-printed for readability
 * - Production: JSON for ELK/Grafana ingestion
 */
export const logger = pino({
    level: config.isDevelopment ? 'debug' : 'info',
    transport: config.isDevelopment
        ? {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
                ignore: 'pid,hostname',
            },
        }
        : undefined, // JSON output in production
    base: {
        service: 'url-shortener-api',
        env: config.env,
    },
});
