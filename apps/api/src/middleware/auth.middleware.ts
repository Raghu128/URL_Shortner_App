import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { UnauthorizedError } from '../common/errors';
import { AuthenticatedRequest } from '../common/types';

interface JwtPayload {
    userId: string; // BigInt serialized as string in JWT
    email: string;
    tier: string;
}

/**
 * JWT authentication middleware.
 * Extracts and verifies Bearer token from Authorization header.
 * Attaches decoded user info to req.user.
 */
export function authMiddleware(
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction,
): void {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new UnauthorizedError('Missing or invalid authorization header');
        }

        const token = authHeader.split(' ')[1];

        const decoded = jwt.verify(token, config.auth.jwtSecret) as JwtPayload;

        req.user = {
            userId: BigInt(decoded.userId),
            email: decoded.email,
            tier: decoded.tier,
        };

        next();
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            next(error);
            return;
        }

        if (error instanceof jwt.JsonWebTokenError) {
            next(new UnauthorizedError('Invalid token'));
            return;
        }

        if (error instanceof jwt.TokenExpiredError) {
            next(new UnauthorizedError('Token expired'));
            return;
        }

        next(new UnauthorizedError());
    }
}

/**
 * Optional auth middleware — doesn't reject unauthenticated requests,
 * but attaches user info if a valid token is present.
 * Used for endpoints that work for both anonymous and authenticated users.
 */
export function optionalAuthMiddleware(
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction,
): void {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            next();
            return;
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, config.auth.jwtSecret) as JwtPayload;

        req.user = {
            userId: BigInt(decoded.userId),
            email: decoded.email,
            tier: decoded.tier,
        };
    } catch {
        // Silently ignore invalid tokens for optional auth
    }

    next();
}
