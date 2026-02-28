/**
 * Base application error class.
 * All custom errors extend this class.
 *
 * - isOperational: true = expected errors (404, 409, etc.)
 * - isOperational: false = programmer errors (bugs) → crash
 */
export class AppError extends Error {
    public readonly statusCode: number;
    public readonly isOperational: boolean;

    constructor(message: string, statusCode: number, isOperational: boolean = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;

        // Maintain proper prototype chain
        Object.setPrototypeOf(this, new.target.prototype);
        Error.captureStackTrace(this, this.constructor);
    }
}
