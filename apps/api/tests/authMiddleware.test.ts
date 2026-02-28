import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authMiddleware, optionalAuthMiddleware } from '../src/middleware/auth.middleware';
import { AuthenticatedRequest } from '../src/common/types';

jest.mock('../src/config', () => ({
    config: {
        auth: {
            jwtSecret: 'test-secret',
        },
    },
}));

jest.mock('../src/config/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// ─── Test Helpers ───

function createMockRequest(headers: Record<string, string> = {}): Partial<AuthenticatedRequest> {
    return { headers } as any;
}

// ─── Tests ───

describe('auth middleware', () => {
    describe('authMiddleware', () => {
        it('should call next() and set req.user for valid JWT', () => {
            const token = jwt.sign(
                { userId: '1', email: 'test@example.com', tier: 'free' },
                'test-secret',
            );
            const req = createMockRequest({ authorization: `Bearer ${token}` });
            const res = {} as Response;
            const next = jest.fn();

            authMiddleware(req as AuthenticatedRequest, res, next as NextFunction);

            expect(next).toHaveBeenCalledWith();
            expect(req.user).toBeDefined();
            expect(req.user!.email).toBe('test@example.com');
        });

        it('should pass UnauthorizedError to next() when no header', () => {
            const req = createMockRequest({});
            const res = {} as Response;
            const next = jest.fn();

            authMiddleware(req as AuthenticatedRequest, res, next as NextFunction);

            expect(next).toHaveBeenCalledWith(
                expect.objectContaining({ statusCode: 401 }),
            );
        });

        it('should pass UnauthorizedError to next() without Bearer prefix', () => {
            const req = createMockRequest({ authorization: 'Basic abc123' });
            const res = {} as Response;
            const next = jest.fn();

            authMiddleware(req as AuthenticatedRequest, res, next as NextFunction);

            expect(next).toHaveBeenCalledWith(
                expect.objectContaining({ statusCode: 401 }),
            );
        });

        it('should pass UnauthorizedError for tokens signed with wrong secret', () => {
            const token = jwt.sign(
                { userId: '1', email: 'test@example.com', tier: 'free' },
                'wrong-secret',
            );
            const req = createMockRequest({ authorization: `Bearer ${token}` });
            const res = {} as Response;
            const next = jest.fn();

            authMiddleware(req as AuthenticatedRequest, res, next as NextFunction);

            expect(next).toHaveBeenCalledWith(
                expect.objectContaining({ statusCode: 401 }),
            );
        });

        it('should convert userId from string to BigInt', () => {
            const token = jwt.sign(
                { userId: '42', email: 'test@example.com', tier: 'free' },
                'test-secret',
            );
            const req = createMockRequest({ authorization: `Bearer ${token}` });
            const res = {} as Response;
            const next = jest.fn();

            authMiddleware(req as AuthenticatedRequest, res, next as NextFunction);

            expect(req.user!.userId).toBe(42n);
        });
    });

    describe('optionalAuthMiddleware', () => {
        it('should attach user for valid token', () => {
            const token = jwt.sign(
                { userId: '1', email: 'test@example.com', tier: 'free' },
                'test-secret',
            );
            const req = createMockRequest({ authorization: `Bearer ${token}` });
            const res = {} as Response;
            const next = jest.fn();

            optionalAuthMiddleware(req as AuthenticatedRequest, res, next as NextFunction);

            expect(next).toHaveBeenCalled();
            expect(req.user).toBeDefined();
        });

        it('should call next() without user if no token', () => {
            const req = createMockRequest({});
            const res = {} as Response;
            const next = jest.fn();

            optionalAuthMiddleware(req as AuthenticatedRequest, res, next as NextFunction);

            expect(next).toHaveBeenCalled();
            expect(req.user).toBeUndefined();
        });

        it('should call next() without user if token is invalid', () => {
            const req = createMockRequest({ authorization: 'Bearer invalid-token' });
            const res = {} as Response;
            const next = jest.fn();

            optionalAuthMiddleware(req as AuthenticatedRequest, res, next as NextFunction);

            expect(next).toHaveBeenCalled();
            expect(req.user).toBeUndefined();
        });
    });
});
