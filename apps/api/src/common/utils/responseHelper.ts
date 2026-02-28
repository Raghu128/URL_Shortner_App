import { Response } from 'express';

/**
 * Standardized API response helpers.
 * All API responses follow a consistent shape:
 *
 * Success: { success: true, data: T, meta?: {...} }
 * Error:   { success: false, error: { message, code, details? } }
 */

interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

/**
 * Send a success response.
 */
export function sendSuccess<T>(res: Response, data: T, statusCode: number = 200): void {
    res.status(statusCode).json({
        success: true,
        data,
    });
}

/**
 * Send a success response with pagination metadata.
 */
export function sendPaginatedSuccess<T>(
    res: Response,
    data: T[],
    pagination: PaginationMeta,
): void {
    res.status(200).json({
        success: true,
        data,
        meta: { pagination },
    });
}

/**
 * Send a created (201) response.
 */
export function sendCreated<T>(res: Response, data: T): void {
    sendSuccess(res, data, 201);
}

/**
 * Send a no-content (204) response.
 */
export function sendNoContent(res: Response): void {
    res.status(204).send();
}

/**
 * Send an error response.
 */
export function sendError(
    res: Response,
    message: string,
    statusCode: number = 500,
    details?: unknown,
): void {
    res.status(statusCode).json({
        success: false,
        error: {
            message,
            code: statusCode,
            ...(details ? { details } : {}),
        },
    });
}
