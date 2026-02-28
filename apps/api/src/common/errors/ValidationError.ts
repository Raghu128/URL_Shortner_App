import { AppError } from './AppError';

export class ValidationError extends AppError {
    public readonly errors: Record<string, string[]> | unknown;

    constructor(errors: Record<string, string[]> | unknown, message: string = 'Validation failed') {
        super(message, 400);
        this.errors = errors;
    }
}
