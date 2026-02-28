import { Response } from 'express';
import {
    sendSuccess,
    sendCreated,
    sendNoContent,
    sendPaginatedSuccess,
    sendError,
} from '../src/common/utils/responseHelper';

// ─── Test Helpers ───

function createMockResponse(): Partial<Response> {
    const res: Partial<Response> = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    return res;
}

// ─── Tests ───

describe('responseHelper', () => {
    describe('sendSuccess', () => {
        it('should send 200 with success shape', () => {
            const res = createMockResponse();
            sendSuccess(res as Response, { id: 1, name: 'test' });

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: { id: 1, name: 'test' },
            });
        });

        it('should accept custom status code', () => {
            const res = createMockResponse();
            sendSuccess(res as Response, {}, 202);

            expect(res.status).toHaveBeenCalledWith(202);
        });
    });

    describe('sendCreated', () => {
        it('should send 201', () => {
            const res = createMockResponse();
            sendCreated(res as Response, { id: 42 });

            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: { id: 42 },
            });
        });
    });

    describe('sendNoContent', () => {
        it('should send 204 with no body', () => {
            const res = createMockResponse();
            sendNoContent(res as Response);

            expect(res.status).toHaveBeenCalledWith(204);
            expect(res.send).toHaveBeenCalled();
        });
    });

    describe('sendPaginatedSuccess', () => {
        it('should include pagination metadata', () => {
            const res = createMockResponse();
            const data = [{ id: 1 }, { id: 2 }];
            const pagination = { page: 1, limit: 10, total: 25, totalPages: 3 };

            sendPaginatedSuccess(res as Response, data, pagination);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data,
                meta: { pagination },
            });
        });
    });

    describe('sendError', () => {
        it('should send error response with correct shape', () => {
            const res = createMockResponse();
            sendError(res as Response, 'Something went wrong', 400);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: {
                    message: 'Something went wrong',
                    code: 400,
                },
            });
        });

        it('should default to 500 status code', () => {
            const res = createMockResponse();
            sendError(res as Response, 'Error');

            expect(res.status).toHaveBeenCalledWith(500);
        });

        it('should include details when provided', () => {
            const res = createMockResponse();
            const details = [{ field: 'email', message: 'Required' }];
            sendError(res as Response, 'Validation failed', 400, details);

            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: {
                    message: 'Validation failed',
                    code: 400,
                    details,
                },
            });
        });

        it('should omit details key when not provided', () => {
            const res = createMockResponse();
            sendError(res as Response, 'Error', 500);

            const responseBody = (res.json as jest.Mock).mock.calls[0][0];
            expect(responseBody.error).not.toHaveProperty('details');
        });
    });
});
