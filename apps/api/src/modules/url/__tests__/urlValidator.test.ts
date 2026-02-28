import { validateUrl } from '../../common/utils/urlValidator';

// Mock config
jest.mock('../../config', () => ({
    config: {
        baseUrl: 'http://localhost:3000',
    },
}));

describe('urlValidator', () => {
    describe('validateUrl', () => {
        it('should accept valid HTTP URLs', () => {
            expect(validateUrl('https://example.com').valid).toBe(true);
            expect(validateUrl('http://example.com/path?q=1').valid).toBe(true);
            expect(validateUrl('https://sub.domain.com/path#anchor').valid).toBe(true);
        });

        it('should reject invalid URLs', () => {
            const result = validateUrl('not-a-url');
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('Invalid URL');
        });

        it('should reject non-HTTP protocols', () => {
            expect(validateUrl('ftp://example.com').valid).toBe(false);
            expect(validateUrl('javascript:alert(1)').valid).toBe(false);
            expect(validateUrl('data:text/html,<h1>XSS</h1>').valid).toBe(false);
        });

        it('should reject self-referencing URLs', () => {
            const result = validateUrl('http://localhost:3000/abc123');
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('Cannot shorten');
        });

        it('should reject blocked domains', () => {
            const result = validateUrl('https://bit.ly/something');
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('not allowed');
        });

        it('should reject URLs exceeding max length', () => {
            const longUrl = 'https://example.com/' + 'a'.repeat(2050);
            const result = validateUrl(longUrl);
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('maximum length');
        });
    });
});
