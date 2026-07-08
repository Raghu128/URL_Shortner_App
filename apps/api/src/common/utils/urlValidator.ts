import { config } from '../../config';
import { logger } from '../../config/logger';

/**
 * List of known malicious or banned domain patterns.
 * Extend this list based on threat intelligence feeds.
 */
const BLOCKED_DOMAINS = [
    'bit.ly',
    'tinyurl.com',
    'goo.gl',
    't.co',
    // Add more URL shorteners to prevent recursive shortening
];

/**
 * Validates that a URL is safe to store and redirect to.
 *
 * Checks:
 * 1. Valid URL format (protocol + hostname)
 * 2. Not a data: or javascript: URI (XSS prevention)
 * 3. Not our own domain (prevent recursion)
 * 4. Not a known malicious or blocked domain
 * 5. Reasonable length (< 2048 chars)
 */
export function validateUrl(url: string): { valid: boolean; reason?: string } {
    // Length check
    if (url.length > 2048) {
        return { valid: false, reason: 'URL exceeds maximum length of 2048 characters' };
    }

    // Parse URL
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return { valid: false, reason: 'Invalid URL format' };
    }

    // Protocol check — only allow http and https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
        return { valid: false, reason: 'Only HTTP and HTTPS URLs are allowed' };
    }

    // Self-reference check — prevent shortening our own short URLs
    const baseHost = new URL(config.baseUrl).hostname;
    if (parsed.hostname === baseHost) {
        return { valid: false, reason: 'Cannot shorten URLs from this service' };
    }

    // Blocked domain check
    const isBlocked = BLOCKED_DOMAINS.some(
        (domain) => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`),
    );
    if (isBlocked) {
        return { valid: false, reason: 'This domain is not allowed' };
    }

    return { valid: true };
}

// ─── Google Safe Browsing Threat Types ───────────────────────────────────────

/** Threat types checked against Google Safe Browsing API v4 */
const SAFE_BROWSING_THREAT_TYPES = [
    'MALWARE',
    'SOCIAL_ENGINEERING',   // Phishing
    'UNWANTED_SOFTWARE',
    'POTENTIALLY_HARMFUL_APPLICATION',
];

/**
 * Checks a URL against the Google Safe Browsing API.
 *
 * Called at SHORT URL CREATION TIME only — never at redirect time.
 * This ensures:
 *   - Malicious URLs are blocked before ever being stored in the DB
 *   - The redirect hot path (GET /:code) has zero external API latency
 *
 * Fail-open: if the API key is missing or the request fails, we log a
 * warning and allow the URL through. This prevents a Google API outage
 * from breaking URL creation for legitimate users.
 *
 * @param url - The original URL to check
 * @returns { safe: boolean; threat?: string }
 *
 * @see https://developers.google.com/safe-browsing/v4/lookup-api
 */
export async function checkUrlSafety(
    url: string,
): Promise<{ safe: boolean; threat?: string }> {
    const apiKey = config.safeBrowsing?.apiKey;

    // If no API key is configured, skip the check (fail-open)
    if (!apiKey) {
        logger.warn({ url }, 'Google Safe Browsing API key not configured — skipping safety check');
        return { safe: true };
    }

    const endpoint = `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`;

    const requestBody = {
        client: {
            clientId: 'url-shortener',
            clientVersion: '1.0.0',
        },
        threatInfo: {
            threatTypes: SAFE_BROWSING_THREAT_TYPES,
            platformTypes: ['ANY_PLATFORM'],
            threatEntryTypes: ['URL'],
            threatEntries: [{ url }],
        },
    };

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(3000), // 3-second timeout — never block indefinitely
        });

        if (!response.ok) {
            logger.warn(
                { status: response.status, url },
                'Safe Browsing API returned non-OK response — allowing URL',
            );
            return { safe: true }; // Fail-open on API errors
        }

        const data = (await response.json()) as { matches?: Array<{ threatType: string }> };

        // If matches array is non-empty, the URL is flagged
        if (data.matches && data.matches.length > 0) {
            const threatType = data.matches[0].threatType;
            logger.warn({ url, threatType }, 'URL flagged by Google Safe Browsing');
            return { safe: false, threat: threatType };
        }

        return { safe: true };
    } catch (error) {
        // Network error, timeout, etc. — fail-open so users are not blocked
        logger.warn({ error, url }, 'Safe Browsing API request failed — allowing URL');
        return { safe: true };
    }
}
