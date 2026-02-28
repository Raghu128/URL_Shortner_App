import dotenv from 'dotenv';
import path from 'path';

// Load .env file from api root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Centralized configuration loader.
 * All environment variables are validated and typed here.
 * No other file should read process.env directly.
 */
export const config = {
    // ─── Server ───
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    baseUrl: process.env.BASE_URL || 'http://localhost:3000',

    // ─── Database (Read/Write Split) ───
    database: {
        primaryUrl: process.env.DATABASE_PRIMARY_URL!,
        replicaUrl: process.env.DATABASE_REPLICA_URL || process.env.DATABASE_PRIMARY_URL!,
    },

    // ─── Redis ───
    redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
    },

    // ─── RabbitMQ ───
    queue: {
        url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
        analyticsQueue: 'click_events',
    },

    // ─── Auth ───
    auth: {
        jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
        jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
        bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),
    },

    // ─── Rate Limiting ───
    rateLimit: {
        windowSeconds: parseInt(process.env.RATE_LIMIT_WINDOW_SECONDS || '60', 10),
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '10', 10),
    },

    // ─── URL Generation ───
    url: {
        shortCodeLength: parseInt(process.env.SHORT_CODE_LENGTH || '7', 10),
        obfuscationKey: BigInt(process.env.OBFUSCATION_KEY || '0x5A3CF1E87D2B'),
    },

    // ─── CORS ───
    cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
    },

    // ─── Flags ───
    isDevelopment: (process.env.NODE_ENV || 'development') === 'development',
    isProduction: process.env.NODE_ENV === 'production',
    isTest: process.env.NODE_ENV === 'test',
} as const;

/**
 * Validate required environment variables at startup.
 * Fail fast if any critical config is missing.
 */
export function validateConfig(): void {
    const required: Array<{ key: string; value: unknown }> = [
        { key: 'DATABASE_PRIMARY_URL', value: config.database.primaryUrl },
    ];

    const missing = required.filter((r) => !r.value);

    if (missing.length > 0) {
        const keys = missing.map((m) => m.key).join(', ');
        throw new Error(`Missing required environment variables: ${keys}`);
    }
}
