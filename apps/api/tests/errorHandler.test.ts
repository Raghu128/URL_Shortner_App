import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../src/middleware/errorHandler.middleware';
import { AppError, NotFoundError, ValidationError, ConflictError } from '../src/common/errors';

// Mock logger
jest.mock('../src/config/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// ─── Test Helpers ───

function createMockResponse(): Partial<Response> {
    const res: Partial<Response> = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

// ─── Tests ───

describe('errorHandler middleware', () => {
    const req = {} as Request;
    const next = jest.fn() as NextFunction;

    it('should handle ValidationError with field details', () => {
        const res = createMockResponse();
        const fieldErrors = [{ field: 'email', message: 'Invalid' }];
        const error = new ValidationError(fieldErrors);

        errorHandler(error, req, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                error: expect.objectContaining({
                    message: 'Validation failed',
                    code: 400,
                    details: fieldErrors,
                }),
            }),
        );
    });

    it('should handle NotFoundError with 404 status', () => {
        const res = createMockResponse();
        const error = new NotFoundError('URL not found');

        errorHandler(error, req, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                error: expect.objectContaining({
                    message: 'URL not found',
                    code: 404,
                }),
            }),
        );
    });

    it('should handle ConflictError with 409 status', () => {
        const res = createMockResponse();
        const error = new ConflictError('Already exists');

        errorHandler(error, req, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(409);
    });

    it('should handle generic AppError', () => {
        const res = createMockResponse();
        const error = new AppError('Custom error', 418);

        errorHandler(error, req, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(418);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                error: expect.objectContaining({ message: 'Custom error' }),
            }),
        );
    });

    it('should handle unexpected errors with generic 500 message', () => {
        const res = createMockResponse();
        const error = new Error('Something broke internally');

        errorHandler(error, req, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                error: expect.objectContaining({
                    message: 'Internal server error',
                }),
            }),
        );
    });

    it('should NOT leak internal error details for unexpected errors', () => {
        const res = createMockResponse();
        const error = new Error('DB connection refused: password=secret123');

        errorHandler(error, req, res as Response, next);

        const responseBody = (res.json as jest.Mock).mock.calls[0][0];
        expect(responseBody.error.message).not.toContain('secret123');
        expect(responseBody.error.message).toBe('Internal server error');
    });
});
