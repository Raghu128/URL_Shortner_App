import { createApp } from './app';
import { config, validateConfig } from './config';
import { logger } from './config/logger';
import { connectDatabase, disconnectDatabase } from './infrastructure/database/prismaClient';
import { connectRedis, disconnectRedis } from './infrastructure/cache/redisClient';
import { connectQueue, disconnectQueue } from './infrastructure/queue/publisher';
import { ExpirationWorker } from './workers/expirationWorker';

/**
 * Server entry point.
 *
 * Startup sequence:
 * 1. Validate config
 * 2. Connect infrastructure (DB, Redis, RabbitMQ)
 * 3. Start Express server
 * 4. Start background workers
 * 5. Register graceful shutdown handlers
 */
async function main(): Promise<void> {
    try {
        // 1. Validate required config
        validateConfig();
        logger.info({ env: config.env }, 'Configuration validated');

        // 2. Connect infrastructure (in parallel where possible)
        await Promise.all([
            connectDatabase(),
            connectRedis(),
            connectQueue(),
        ]);

        // 3. Create and start Express app
        const app = createApp();
        const server = app.listen(config.port, () => {
            logger.info(
                { port: config.port, env: config.env, baseUrl: config.baseUrl },
                `🚀 URL Shortener API running on port ${config.port}`,
            );
        });

        // 4. Start background workers
        const expirationWorker = new ExpirationWorker();
        expirationWorker.start(60_000); // Check for expired URLs every 60 seconds

        // 5. Graceful shutdown
        const shutdown = async (signal: string) => {
            logger.info({ signal }, 'Shutdown signal received, starting graceful shutdown...');

            // Stop accepting new connections
            server.close(() => {
                logger.info('HTTP server closed');
            });

            // Stop workers
            expirationWorker.stop();

            // Disconnect infrastructure
            await Promise.allSettled([
                disconnectDatabase(),
                disconnectRedis(),
                disconnectQueue(),
            ]);

            logger.info('Graceful shutdown complete');
            process.exit(0);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));

        // Handle unhandled rejections and uncaught exceptions
        process.on('unhandledRejection', (reason) => {
            logger.error({ reason }, 'Unhandled Promise Rejection');
            // In production, you might want to exit and let the orchestrator restart
        });

        process.on('uncaughtException', (error) => {
            logger.fatal({ error }, 'Uncaught Exception — shutting down');
            process.exit(1);
        });
    } catch (error) {
        logger.fatal({ error }, 'Failed to start server');
        process.exit(1);
    }
}

main();
