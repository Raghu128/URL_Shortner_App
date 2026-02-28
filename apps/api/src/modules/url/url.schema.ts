import { z } from 'zod';

/**
 * Zod schemas for URL endpoint validation.
 * Validated via validateRequest middleware before hitting the controller.
 */

export const createUrlSchema = z.object({
    body: z.object({
        url: z
            .string({ required_error: 'URL is required' })
            .url('Invalid URL format')
            .max(2048, 'URL must be at most 2048 characters'),
        customAlias: z
            .string()
            .min(3, 'Custom alias must be at least 3 characters')
            .max(20, 'Custom alias must be at most 20 characters')
            .regex(
                /^[a-zA-Z0-9_-]+$/,
                'Custom alias can only contain letters, numbers, hyphens, and underscores',
            )
            .optional(),
        expiresAt: z.string().datetime({ message: 'Invalid date format' }).optional(),
    }),
});

export const getUrlParamsSchema = z.object({
    params: z.object({
        code: z
            .string()
            .min(3, 'Short code must be at least 3 characters')
            .max(20, 'Short code must be at most 20 characters')
            .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid short code format'),
    }),
});

export const updateUrlSchema = z.object({
    params: z.object({
        code: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_-]+$/),
    }),
    body: z.object({
        isActive: z.boolean().optional(),
        expiresAt: z.string().datetime().nullable().optional(),
    }),
});

export const listUrlsSchema = z.object({
    query: z.object({
        page: z.coerce.number().int().positive().default(1).optional(),
        limit: z.coerce.number().int().positive().max(100).default(20).optional(),
    }),
});
