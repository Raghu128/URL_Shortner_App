import { config } from '../../config';

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
