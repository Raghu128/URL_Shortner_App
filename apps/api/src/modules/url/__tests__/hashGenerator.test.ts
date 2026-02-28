import { encodeToBase62, decodeFromBase62, isValidShortCode } from '../../common/utils/hashGenerator';

describe('hashGenerator', () => {
    describe('encodeToBase62', () => {
        it('should encode a BigInt ID to a Base62 string', () => {
            const code = encodeToBase62(1n);
            expect(typeof code).toBe('string');
            expect(code.length).toBeGreaterThanOrEqual(6);
        });

        it('should produce different codes for different IDs', () => {
            const code1 = encodeToBase62(1n);
            const code2 = encodeToBase62(2n);
            const code3 = encodeToBase62(1000n);

            expect(code1).not.toBe(code2);
            expect(code2).not.toBe(code3);
        });

        it('should produce consistent output for the same input', () => {
            const code1 = encodeToBase62(42n);
            const code2 = encodeToBase62(42n);

            expect(code1).toBe(code2);
        });

        it('should handle large IDs', () => {
            const code = encodeToBase62(999999999n);
            expect(typeof code).toBe('string');
            expect(code.length).toBeGreaterThanOrEqual(6);
        });
    });

    describe('decodeFromBase62', () => {
        it('should decode back to the original ID', () => {
            const originalId = 42n;
            const encoded = encodeToBase62(originalId);
            const decoded = decodeFromBase62(encoded);

            expect(decoded).toBe(originalId);
        });

        it('should round-trip for various IDs', () => {
            const ids = [1n, 100n, 12345n, 9999999n, 123456789012n];

            for (const id of ids) {
                const encoded = encodeToBase62(id);
                const decoded = decodeFromBase62(encoded);
                expect(decoded).toBe(id);
            }
        });

        it('should throw for invalid Base62 characters', () => {
            expect(() => decodeFromBase62('abc!@#')).toThrow('Invalid Base62 character');
        });
    });

    describe('isValidShortCode', () => {
        it('should accept valid short codes', () => {
            expect(isValidShortCode('abc123')).toBe(true);
            expect(isValidShortCode('my-link')).toBe(true);
            expect(isValidShortCode('test_url')).toBe(true);
            expect(isValidShortCode('AbCdEf')).toBe(true);
        });

        it('should reject codes that are too short', () => {
            expect(isValidShortCode('ab')).toBe(false);
            expect(isValidShortCode('a')).toBe(false);
        });

        it('should reject codes that are too long', () => {
            expect(isValidShortCode('a'.repeat(21))).toBe(false);
        });

        it('should reject codes with invalid characters', () => {
            expect(isValidShortCode('abc 123')).toBe(false);
            expect(isValidShortCode('abc!@#')).toBe(false);
            expect(isValidShortCode('hello world')).toBe(false);
        });
    });
});
