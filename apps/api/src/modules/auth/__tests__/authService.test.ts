import { AuthService } from '../auth.service';
import { ConflictError, UnauthorizedError } from '../../../common/errors';

// ─── Mocks ───

const mockAuthRepository = {
    findByEmail: jest.fn(),
    create: jest.fn(),
};

jest.mock('bcrypt', () => ({
    hash: jest.fn().mockResolvedValue('$2b$10$hashedpassword'),
    compare: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
    sign: jest.fn().mockReturnValue('mock-jwt-token'),
}));

jest.mock('../../../config', () => ({
    config: {
        auth: {
            jwtSecret: 'test-secret',
            jwtExpiresIn: '7d',
            bcryptSaltRounds: 10,
        },
    },
}));

jest.mock('../../../config/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// ─── Test Helpers ───

function createMockUser(overrides = {}) {
    return {
        id: 1n,
        email: 'test@example.com',
        name: 'Test User',
        passwordHash: '$2b$10$hashedpassword',
        tier: 'free',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    };
}

// ─── Tests ───

describe('AuthService', () => {
    let authService: AuthService;
    const bcrypt = require('bcrypt');

    beforeEach(() => {
        jest.clearAllMocks();
        authService = new AuthService(mockAuthRepository as any);
    });

    // ═══════════════════════════════════════
    // register
    // ═══════════════════════════════════════
    describe('register', () => {
        it('should register a new user successfully', async () => {
            mockAuthRepository.findByEmail.mockResolvedValue(null);
            mockAuthRepository.create.mockResolvedValue(createMockUser());

            const result = await authService.register({
                email: 'test@example.com',
                password: 'SecurePass1',
                name: 'Test User',
            });

            expect(result.user.email).toBe('test@example.com');
            expect(result.user.name).toBe('Test User');
            expect(result.accessToken).toBe('mock-jwt-token');
            expect(mockAuthRepository.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    email: 'test@example.com',
                    passwordHash: '$2b$10$hashedpassword',
                    name: 'Test User',
                }),
            );
        });

        it('should throw ConflictError if email already exists', async () => {
            mockAuthRepository.findByEmail.mockResolvedValue(createMockUser());

            await expect(
                authService.register({
                    email: 'test@example.com',
                    password: 'SecurePass1',
                }),
            ).rejects.toThrow(ConflictError);
        });

        it('should hash the password with bcrypt', async () => {
            mockAuthRepository.findByEmail.mockResolvedValue(null);
            mockAuthRepository.create.mockResolvedValue(createMockUser());

            await authService.register({
                email: 'test@example.com',
                password: 'SecurePass1',
            });

            expect(bcrypt.hash).toHaveBeenCalledWith('SecurePass1', 10);
        });

        it('should return user ID as string (BigInt serialization)', async () => {
            mockAuthRepository.findByEmail.mockResolvedValue(null);
            mockAuthRepository.create.mockResolvedValue(createMockUser({ id: 42n }));

            const result = await authService.register({
                email: 'test@example.com',
                password: 'SecurePass1',
            });

            expect(result.user.id).toBe('42');
        });
    });

    // ═══════════════════════════════════════
    // login
    // ═══════════════════════════════════════
    describe('login', () => {
        it('should login with valid credentials', async () => {
            mockAuthRepository.findByEmail.mockResolvedValue(createMockUser());
            bcrypt.compare.mockResolvedValue(true);

            const result = await authService.login({
                email: 'test@example.com',
                password: 'SecurePass1',
            });

            expect(result.user.email).toBe('test@example.com');
            expect(result.accessToken).toBe('mock-jwt-token');
        });

        it('should throw UnauthorizedError if user not found (prevent email enumeration)', async () => {
            mockAuthRepository.findByEmail.mockResolvedValue(null);

            await expect(
                authService.login({
                    email: 'nonexistent@example.com',
                    password: 'SecurePass1',
                }),
            ).rejects.toThrow(UnauthorizedError);
        });

        it('should use generic error message (no email enumeration)', async () => {
            mockAuthRepository.findByEmail.mockResolvedValue(null);

            try {
                await authService.login({
                    email: 'nonexistent@example.com',
                    password: 'SecurePass1',
                });
            } catch (err: any) {
                expect(err.message).toBe('Invalid email or password');
            }
        });

        it('should throw UnauthorizedError if password is wrong', async () => {
            mockAuthRepository.findByEmail.mockResolvedValue(createMockUser());
            bcrypt.compare.mockResolvedValue(false);

            await expect(
                authService.login({
                    email: 'test@example.com',
                    password: 'WrongPassword',
                }),
            ).rejects.toThrow(UnauthorizedError);
        });

        it('should use the same error message for wrong password (prevent enumeration)', async () => {
            mockAuthRepository.findByEmail.mockResolvedValue(createMockUser());
            bcrypt.compare.mockResolvedValue(false);

            try {
                await authService.login({
                    email: 'test@example.com',
                    password: 'WrongPassword',
                });
            } catch (err: any) {
                expect(err.message).toBe('Invalid email or password');
            }
        });
    });
});
