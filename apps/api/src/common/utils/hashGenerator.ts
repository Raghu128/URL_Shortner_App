import { config } from '../../config';

const BASE62_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const BASE = BigInt(BASE62_CHARS.length); // 62

/**
 * Encode a numeric auto-increment ID into a Base62 short code.
 * Uses XOR obfuscation to prevent sequential guessing of IDs.
 *
 * Why Base62? → 62^7 = ~3.5 trillion unique codes with 7 characters.
 * Why XOR? → Prevents users from guessing URL IDs (aB3xZ9 doesn't reveal it's ID #42).
 *
 * @param id - The auto-increment BigInt ID from PostgreSQL
 * @returns A Base62-encoded short code string
 */
export function encodeToBase62(id: bigint): string {
    const obfuscated = id ^ config.url.obfuscationKey;

    if (obfuscated === 0n) {
        return BASE62_CHARS[0].repeat(config.url.shortCodeLength);
    }

    let encoded = '';
    let num = obfuscated < 0n ? -obfuscated : obfuscated;

    while (num > 0n) {
        encoded = BASE62_CHARS[Number(num % BASE)] + encoded;
        num = num / BASE;
    }

    // Pad to minimum length
    return encoded.padStart(config.url.shortCodeLength, BASE62_CHARS[0]);
}

/**
 * Decode a Base62 short code back to the original numeric ID.
 * Reverses the XOR obfuscation.
 *
 * @param code - The Base62 short code
 * @returns The original BigInt ID
 */
export function decodeFromBase62(code: string): bigint {
    let decoded = 0n;

    for (const char of code) {
        const index = BASE62_CHARS.indexOf(char);
        if (index === -1) {
            throw new Error(`Invalid Base62 character: ${char}`);
        }
        decoded = decoded * BASE + BigInt(index);
    }

    return decoded ^ config.url.obfuscationKey;
}

/**
 * Validate that a string is a valid Base62 short code.
 */
export function isValidShortCode(code: string): boolean {
    if (code.length < 3 || code.length > 20) return false;
    return /^[a-zA-Z0-9_-]+$/.test(code);
}
