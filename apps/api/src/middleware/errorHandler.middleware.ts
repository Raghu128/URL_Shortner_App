import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../common/errors';
import { sendError } from '../common/utils/responseHelper';
import { logger } from '../config/logger';

/**
 * Global error handler middleware.
 * Must be registered LAST in the middleware chain.
 *
 * - Operational errors (AppError): Send structured error response
 * - Validation errors: Include field-level details
 * - Unexpected errors: Log details, send generic 500
 */
export function errorHandler(
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction,
): void {
    // Validation errors — include field details
    if (err instanceof ValidationError) {
        logger.warn({ error: err.message }, 'Validation error');
        sendError(res, err.message, err.statusCode, err.errors);
        return;
    }

    // Operational errors — expected, send the error message
    if (err instanceof AppError) {
        logger.warn({ error: err.message, statusCode: err.statusCode }, 'Operational error');
        sendError(res, err.message, err.statusCode);
        return;
    }

    // Prisma known request error (e.g., unique constraint violation)
    if (err.constructor.name === 'PrismaClientKnownRequestError') {
        const prismaErr = err as unknown as { code: string; meta?: { target?: string[] } };
        if (prismaErr.code === 'P2002') {
            const target = prismaErr.meta?.target?.join(', ') || 'field';
            sendError(res, `A record with this ${target} already exists`, 409);
            return;
        }
    }

    // Unexpected errors — don't leak internal details
    logger.error({ error: err, stack: err.stack }, 'Unexpected error');
    sendError(res, 'Internal server error', 500);
}
