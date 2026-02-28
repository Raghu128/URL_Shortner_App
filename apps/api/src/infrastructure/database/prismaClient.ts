import { PrismaClient } from '@prisma/client';
import { config } from '../../config';
import { logger } from '../../config/logger';

/**
 * PRIMARY client — used ONLY for writes (create, update, delete).
 * Connects directly to the PostgreSQL primary instance.
 */
export const prismaWrite = new PrismaClient({
    datasources: {
        db: { url: config.database.primaryUrl },
    },
    log: config.isDevelopment
        ? [
            { level: 'query', emit: 'event' },
            { level: 'warn', emit: 'stdout' },
            { level: 'error', emit: 'stdout' },
        ]
        : [
            { level: 'warn', emit: 'stdout' },
            { level: 'error', emit: 'stdout' },
        ],
});

/**
 * REPLICA client — used for ALL reads (redirect lookups, user queries, dashboard).
 * Connects to PgBouncer which load-balances across read replicas.
 * Falls back to primary URL if replica URL is not configured.
 */
export const prismaRead = new PrismaClient({
    datasources: {
        db: { url: config.database.replicaUrl },
    },
    log: config.isDevelopment
        ? [
            { level: 'query', emit: 'event' },
            { level: 'warn', emit: 'stdout' },
            { level: 'error', emit: 'stdout' },
        ]
        : [
            { level: 'warn', emit: 'stdout' },
            { level: 'error', emit: 'stdout' },
        ],
});

/**
 * Connect both Prisma clients.
 * Called once at server startup.
 */
export async function connectDatabase(): Promise<void> {
    try {
        await prismaWrite.$connect();
        logger.info('✅ Connected to PostgreSQL PRIMARY (writes)');

        await prismaRead.$connect();
        logger.info('✅ Connected to PostgreSQL REPLICA (reads)');
    } catch (error) {
        logger.error({ error }, '❌ Failed to connect to PostgreSQL');
        throw error;
    }
}

/**
 * Disconnect both Prisma clients.
 * Called during graceful shutdown.
 */
export async function disconnectDatabase(): Promise<void> {
    await prismaWrite.$disconnect();
    await prismaRead.$disconnect();
    logger.info('PostgreSQL connections closed');
}
