/**
 * Application-wide constants.
 * Centralized to avoid magic numbers/strings scattered across the codebase.
 */

/** Cache key prefixes */
export const CACHE_KEYS = {
    URL_PREFIX: 'url:',
    RATE_LIMIT_PREFIX: 'ratelimit:',
} as const;

/** Cache TTLs in seconds */
export const CACHE_TTL = {
    URL_MAPPING: 86400, // 24 hours
    RATE_LIMIT: 60, // 1 minute
} as const;

/** Pagination defaults */
export const PAGINATION = {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
} as const;

/** HTTP status codes (for readability) */
export const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    MOVED_PERMANENTLY: 301,
    FOUND: 302,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    NOT_FOUND: 404,
    CONFLICT: 409,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
} as const;

/** User tiers */
export const USER_TIERS = {
    FREE: 'free',
    PRO: 'pro',
    ENTERPRISE: 'enterprise',
} as const;

/** Rate limits by user tier (requests per minute) */
export const TIER_RATE_LIMITS: Record<string, number> = {
    [USER_TIERS.FREE]: 10,
    [USER_TIERS.PRO]: 100,
    [USER_TIERS.ENTERPRISE]: 1000,
} as const;
