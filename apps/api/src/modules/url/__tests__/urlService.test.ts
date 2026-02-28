import { UrlService } from '../url.service';
import { ConflictError, NotFoundError, ValidationError } from '../../../common/errors';

// ─── Mock dependencies ───

const mockUrlRepository = {
    findByCode: jest.fn(),
    findByCodeFromPrimary: jest.fn(),
    findByUserId: jest.fn(),
    countByUserId: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    incrementClickCount: jest.fn(),
};

const mockCache = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
};

// Mock logger
jest.mock('../../../config/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// Mock config
jest.mock('../../../config', () => ({
    config: { baseUrl: 'http://localhost:3000' },
}));

// Mock prismaWrite (used in updateShortCode)
jest.mock('../../../infrastructure/database/prismaClient', () => ({
    prismaWrite: {
        url: {
            update: jest.fn().mockResolvedValue({
                id: 1n,
                shortCode: 'aB3xZ9k',
                originalUrl: 'https://example.com',
                isActive: true,
                isCustom: false,
                clickCount: 0,
                createdAt: new Date(),
                updatedAt: new Date(),
                userId: null,
                expiresAt: null,
            }),
        },
    },
}));

// ─── Test Helpers ───

function createMockUrl(overrides = {}) {
    return {
        id: 1n,
        shortCode: 'aB3xZ9k',
        originalUrl: 'https://example.com',
        isActive: true,
        isCustom: false,
        clickCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: 1n,
        expiresAt: null,
        ...overrides,
    };
}

// ─── Tests ───

describe('UrlService', () => {
    let urlService: UrlService;

    beforeEach(() => {
        jest.clearAllMocks();
        urlService = new UrlService(mockUrlRepository as any, mockCache as any);
    });

    // ═══════════════════════════════════════
    // resolveUrl — Three-Tier Read Strategy
    // ═══════════════════════════════════════
    describe('resolveUrl', () => {
        it('should return URL from cache (Tier 1)', async () => {
            mockCache.get.mockResolvedValue('https://example.com');

            const result = await urlService.resolveUrl('aB3xZ9k');

            expect(result).toBe('https://example.com');
            expect(mockCache.get).toHaveBeenCalledWith('url:aB3xZ9k');
            expect(mockUrlRepository.findByCode).not.toHaveBeenCalled();
        });

        it('should return URL from read replica if not cached (Tier 2)', async () => {
            mockCache.get.mockResolvedValue(null);
            mockUrlRepository.findByCode.mockResolvedValue(createMockUrl());

            const result = await urlService.resolveUrl('aB3xZ9k');

            expect(result).toBe('https://example.com');
            expect(mockUrlRepository.findByCode).toHaveBeenCalledWith('aB3xZ9k');
            expect(mockUrlRepository.findByCodeFromPrimary).not.toHaveBeenCalled();
            // Should populate cache after replica hit
            expect(mockCache.set).toHaveBeenCalled();
        });

        it('should fallback to primary if not found on replica (Tier 3)', async () => {
            mockCache.get.mockResolvedValue(null);
            mockUrlRepository.findByCode.mockResolvedValue(null);
            mockUrlRepository.findByCodeFromPrimary.mockResolvedValue(createMockUrl());

            const result = await urlService.resolveUrl('aB3xZ9k');

            expect(result).toBe('https://example.com');
            expect(mockUrlRepository.findByCodeFromPrimary).toHaveBeenCalledWith('aB3xZ9k');
        });

        it('should throw NotFoundError if URL not found anywhere', async () => {
            mockCache.get.mockResolvedValue(null);
            mockUrlRepository.findByCode.mockResolvedValue(null);
            mockUrlRepository.findByCodeFromPrimary.mockResolvedValue(null);

            await expect(urlService.resolveUrl('notfound')).rejects.toThrow(NotFoundError);
        });

        it('should throw NotFoundError for inactive URLs', async () => {
            mockCache.get.mockResolvedValue(null);
            mockUrlRepository.findByCode.mockResolvedValue(createMockUrl({ isActive: false }));

            await expect(urlService.resolveUrl('aB3xZ9k')).rejects.toThrow(NotFoundError);
        });

        it('should throw NotFoundError for expired URLs', async () => {
            const expiredDate = new Date('2020-01-01');
            mockCache.get.mockResolvedValue(null);
            mockUrlRepository.findByCode.mockResolvedValue(createMockUrl({ expiresAt: expiredDate }));

            await expect(urlService.resolveUrl('aB3xZ9k')).rejects.toThrow(NotFoundError);
        });

        it('should allow URLs that have not expired yet', async () => {
            const futureDate = new Date(Date.now() + 86400000); // tomorrow
            mockCache.get.mockResolvedValue(null);
            mockUrlRepository.findByCode.mockResolvedValue(createMockUrl({ expiresAt: futureDate }));

            const result = await urlService.resolveUrl('aB3xZ9k');
            expect(result).toBe('https://example.com');
        });
    });

    // ═══════════════════════════════════════
    // createShortUrl
    // ═══════════════════════════════════════
    describe('createShortUrl', () => {
        it('should reject invalid URLs', async () => {
            await expect(
                urlService.createShortUrl({ originalUrl: 'not-a-url' }),
            ).rejects.toThrow(ValidationError);
        });

        it('should reject self-referencing URLs', async () => {
            await expect(
                urlService.createShortUrl({ originalUrl: 'http://localhost:3000/abc' }),
            ).rejects.toThrow(ValidationError);
        });

        it('should create custom alias when provided', async () => {
            mockUrlRepository.findByCode.mockResolvedValue(null);
            mockUrlRepository.create.mockResolvedValue(
                createMockUrl({ shortCode: 'my-link', isCustom: true }),
            );
            mockCache.set.mockResolvedValue(undefined);

            const result = await urlService.createShortUrl({
                originalUrl: 'https://example.com',
                customAlias: 'my-link',
            });

            expect(result.shortCode).toBe('my-link');
            expect(result.isCustom).toBe(true);
            expect(mockUrlRepository.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    shortCode: 'my-link',
                    isCustom: true,
                }),
            );
        });

        it('should throw ConflictError if custom alias is taken', async () => {
            mockUrlRepository.findByCode.mockResolvedValue(createMockUrl());

            await expect(
                urlService.createShortUrl({
                    originalUrl: 'https://example.com',
                    customAlias: 'taken-alias',
                }),
            ).rejects.toThrow(ConflictError);
        });
    });

    // ═══════════════════════════════════════
    // getUrlByCode
    // ═══════════════════════════════════════
    describe('getUrlByCode', () => {
        it('should return URL when found and active', async () => {
            mockUrlRepository.findByCode.mockResolvedValue(createMockUrl());

            const result = await urlService.getUrlByCode('aB3xZ9k');
            expect(result.originalUrl).toBe('https://example.com');
        });

        it('should throw NotFoundError when URL not found', async () => {
            mockUrlRepository.findByCode.mockResolvedValue(null);

            await expect(urlService.getUrlByCode('missing')).rejects.toThrow(NotFoundError);
        });

        it('should throw NotFoundError when URL is inactive', async () => {
            mockUrlRepository.findByCode.mockResolvedValue(createMockUrl({ isActive: false }));

            await expect(urlService.getUrlByCode('aB3xZ9k')).rejects.toThrow(NotFoundError);
        });
    });

    // ═══════════════════════════════════════
    // getUrlsByUser
    // ═══════════════════════════════════════
    describe('getUrlsByUser', () => {
        it('should return paginated URLs and total count', async () => {
            const urls = [createMockUrl(), createMockUrl({ id: 2n, shortCode: 'xYz456' })];
            mockUrlRepository.findByUserId.mockResolvedValue(urls);
            mockUrlRepository.countByUserId.mockResolvedValue(2);

            const result = await urlService.getUrlsByUser(1n, 1, 10);

            expect(result.urls).toHaveLength(2);
            expect(result.total).toBe(2);
            expect(mockUrlRepository.findByUserId).toHaveBeenCalledWith(1n, 1, 10);
        });
    });

    // ═══════════════════════════════════════
    // updateUrl
    // ═══════════════════════════════════════
    describe('updateUrl', () => {
        it('should update a URL owned by the user', async () => {
            const url = createMockUrl({ userId: 1n });
            const updatedUrl = createMockUrl({ userId: 1n, isActive: false });
            mockUrlRepository.findByCode.mockResolvedValue(url);
            mockUrlRepository.update.mockResolvedValue(updatedUrl);

            const result = await urlService.updateUrl('aB3xZ9k', 1n, { isActive: false });
            expect(result.isActive).toBe(false);
        });

        it('should invalidate cache when deactivating a URL', async () => {
            mockUrlRepository.findByCode.mockResolvedValue(createMockUrl({ userId: 1n }));
            mockUrlRepository.update.mockResolvedValue(createMockUrl({ isActive: false }));

            await urlService.updateUrl('aB3xZ9k', 1n, { isActive: false });

            expect(mockCache.del).toHaveBeenCalledWith('url:aB3xZ9k');
        });

        it('should throw NotFoundError if URL does not exist', async () => {
            mockUrlRepository.findByCode.mockResolvedValue(null);

            await expect(urlService.updateUrl('missing', 1n, {})).rejects.toThrow(NotFoundError);
        });

        it('should throw NotFoundError if user does not own the URL', async () => {
            mockUrlRepository.findByCode.mockResolvedValue(createMockUrl({ userId: 99n }));

            await expect(urlService.updateUrl('aB3xZ9k', 1n, {})).rejects.toThrow(NotFoundError);
        });
    });

    // ═══════════════════════════════════════
    // deleteUrl
    // ═══════════════════════════════════════
    describe('deleteUrl', () => {
        it('should soft-delete a URL and invalidate cache', async () => {
            mockUrlRepository.findByCode.mockResolvedValue(createMockUrl({ userId: 1n }));
            mockUrlRepository.softDelete.mockResolvedValue(undefined);

            await urlService.deleteUrl('aB3xZ9k', 1n);

            expect(mockUrlRepository.softDelete).toHaveBeenCalledWith('aB3xZ9k');
            expect(mockCache.del).toHaveBeenCalledWith('url:aB3xZ9k');
        });

        it('should throw NotFoundError if URL does not exist', async () => {
            mockUrlRepository.findByCode.mockResolvedValue(null);

            await expect(urlService.deleteUrl('missing', 1n)).rejects.toThrow(NotFoundError);
        });

        it('should throw NotFoundError if user does not own the URL', async () => {
            mockUrlRepository.findByCode.mockResolvedValue(createMockUrl({ userId: 99n }));

            await expect(urlService.deleteUrl('aB3xZ9k', 1n)).rejects.toThrow(NotFoundError);
        });
    });
});
