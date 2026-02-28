import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { ValidationError } from '../common/errors';

/**
 * Generic request validation middleware using Zod schemas.
 *
 * Validates req.body, req.query, and req.params against the provided schema.
 * Throws a ValidationError with field-level details on failure.
 *
 * Usage:
 *   router.post('/urls', validateRequest(createUrlSchema), controller.create);
 */
export function validateRequest(schema: ZodSchema) {
    return (req: Request, _res: Response, next: NextFunction): void => {
        const result = schema.safeParse({
            body: req.body,
            query: req.query,
            params: req.params,
        });

        if (!result.success) {
            const formattedErrors = result.error.flatten();
            throw new ValidationError(formattedErrors, 'Validation failed');
        }

        next();
    };
}
