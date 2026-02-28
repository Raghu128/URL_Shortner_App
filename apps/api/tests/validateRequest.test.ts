import { Request, Response, NextFunction } from 'express';
import { validateRequest } from '../src/middleware/validateRequest.middleware';
import { ValidationError } from '../src/common/errors';
import { z } from 'zod';

// ─── Tests ───

describe('validateRequest middleware', () => {
    function createMockReq(body = {}, query = {}, params = {}): Partial<Request> {
        return { body, query, params } as any;
    }

    const res = {} as Response;

    const schema = z.object({
        body: z.object({
            url: z.string().url(),
            customAlias: z.string().min(3).optional(),
        }),
    });

    it('should call next() for valid input', () => {
        const req = createMockReq({ url: 'https://example.com' });
        const next = jest.fn();

        const middleware = validateRequest(schema);
        middleware(req as Request, res, next as NextFunction);

        expect(next).toHaveBeenCalled();
    });

    it('should throw ValidationError for invalid input', () => {
        const req = createMockReq({ url: 'not-a-url' });
        const next = jest.fn();

        const middleware = validateRequest(schema);

        expect(() => {
            middleware(req as Request, res, next as NextFunction);
        }).toThrow(ValidationError);

        expect(next).not.toHaveBeenCalled();
    });

    it('should include field-level details in the thrown error', () => {
        const req = createMockReq({ url: 'not-a-url' });
        const next = jest.fn();

        const middleware = validateRequest(schema);

        try {
            middleware(req as Request, res, next as NextFunction);
        } catch (err) {
            expect(err).toBeInstanceOf(ValidationError);
            const ve = err as ValidationError;
            expect(ve.errors).toBeDefined();
            expect(ve.statusCode).toBe(400);
        }
    });

    it('should accept input with optional fields missing', () => {
        const req = createMockReq({ url: 'https://example.com' });
        const next = jest.fn();

        const middleware = validateRequest(schema);
        middleware(req as Request, res, next as NextFunction);

        expect(next).toHaveBeenCalled();
    });

    it('should throw for missing required fields', () => {
        const req = createMockReq({});
        const next = jest.fn();

        const middleware = validateRequest(schema);

        expect(() => {
            middleware(req as Request, res, next as NextFunction);
        }).toThrow(ValidationError);
    });
});
