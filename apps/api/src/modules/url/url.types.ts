import { Url } from '@prisma/client';

/** DTO for creating a new short URL */
export interface CreateUrlDto {
    originalUrl: string;
    customAlias?: string;
    expiresAt?: Date;
    userId?: bigint;
}

/** DTO for updating an existing URL */
export interface UpdateUrlDto {
    isActive?: boolean;
    expiresAt?: Date | null;
}

/** Response shape returned to the client */
export interface UrlResponse {
    shortCode: string;
    shortUrl: string;
    originalUrl: string;
    isCustom: boolean;
    expiresAt: Date | null;
    clickCount: number;
    isActive: boolean;
    createdAt: Date;
}

/** Convert a Prisma Url entity to a client-facing response */
export function toUrlResponse(url: Url, baseUrl: string): UrlResponse {
    return {
        shortCode: url.shortCode,
        shortUrl: `${baseUrl}/${url.shortCode}`,
        originalUrl: url.originalUrl,
        isCustom: url.isCustom,
        expiresAt: url.expiresAt,
        clickCount: Number(url.clickCount),
        isActive: url.isActive,
        createdAt: url.createdAt,
    };
}
