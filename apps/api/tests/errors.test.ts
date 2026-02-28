import { AppError } from '../src/common/errors/AppError';
import { NotFoundError } from '../src/common/errors/NotFoundError';
import { ValidationError } from '../src/common/errors/ValidationError';
import { ConflictError } from '../src/common/errors/ConflictError';
import { UnauthorizedError } from '../src/common/errors/UnauthorizedError';

describe('Error Classes', () => {
    // ═══════════════════════════════════════
    // AppError (Base)
    // ═══════════════════════════════════════
    describe('AppError', () => {
        it('should create an operational error with correct properties', () => {
            const error = new AppError('Something went wrong', 400);

            expect(error.message).toBe('Something went wrong');
            expect(error.statusCode).toBe(400);
            expect(error.isOperational).toBe(true);
            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(AppError);
        });

        it('should default isOperational to true', () => {
            const error = new AppError('Test', 500);
            expect(error.isOperational).toBe(true);
        });

        it('should allow non-operational errors (programmer bugs)', () => {
            const error = new AppError('Bug', 500, false);
            expect(error.isOperational).toBe(false);
        });

        it('should have a stack trace', () => {
            const error = new AppError('Test', 400);
            expect(error.stack).toBeDefined();
        });
    });

    // ═══════════════════════════════════════
    // NotFoundError
    // ═══════════════════════════════════════
    describe('NotFoundError', () => {
        it('should have status code 404', () => {
            const error = new NotFoundError('Resource not found');
            expect(error.statusCode).toBe(404);
            expect(error.message).toBe('Resource not found');
            expect(error.isOperational).toBe(true);
        });

        it('should be an instance of AppError', () => {
            const error = new NotFoundError('Not found');
            expect(error).toBeInstanceOf(AppError);
        });
    });

    // ═══════════════════════════════════════
    // ValidationError
    // ═══════════════════════════════════════
    describe('ValidationError', () => {
        it('should have status code 400', () => {
            const error = new ValidationError(null, 'Invalid input');
            expect(error.statusCode).toBe(400);
        });

        it('should store field errors', () => {
            const fieldErrors = [
                { field: 'email', message: 'Invalid email format' },
                { field: 'password', message: 'Too short' },
            ];
            const error = new ValidationError(fieldErrors);

            expect(error.errors).toEqual(fieldErrors);
            expect(error.message).toBe('Validation failed');
        });

        it('should use custom message when field errors are null', () => {
            const error = new ValidationError(null, 'URL is invalid');
            expect(error.message).toBe('URL is invalid');
            expect(error.errors).toBeNull();
        });

        it('should be an instance of AppError', () => {
            const error = new ValidationError(null, 'Test');
            expect(error).toBeInstanceOf(AppError);
        });
    });

    // ═══════════════════════════════════════
    // ConflictError
    // ═══════════════════════════════════════
    describe('ConflictError', () => {
        it('should have status code 409', () => {
            const error = new ConflictError('Already exists');
            expect(error.statusCode).toBe(409);
            expect(error.message).toBe('Already exists');
            expect(error.isOperational).toBe(true);
        });
    });

    // ═══════════════════════════════════════
    // UnauthorizedError
    // ═══════════════════════════════════════
    describe('UnauthorizedError', () => {
        it('should have status code 401', () => {
            const error = new UnauthorizedError('Access denied');
            expect(error.statusCode).toBe(401);
            expect(error.message).toBe('Access denied');
            expect(error.isOperational).toBe(true);
        });
    });
});
