const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * API client for the URL Shortener backend.
 * Handles authentication headers and JSON parsing.
 */

interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: { message: string; code: number; details?: unknown };
    meta?: { pagination?: { page: number; limit: number; total: number; totalPages: number } };
}

async function request<T>(
    endpoint: string,
    options: RequestInit = {},
): Promise<ApiResponse<T>> {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
    });

    const data = await res.json();
    return data as ApiResponse<T>;
}

// ─── URL Endpoints ───

export interface UrlData {
    shortCode: string;
    shortUrl: string;
    originalUrl: string;
    isCustom: boolean;
    expiresAt: string | null;
    clickCount: number;
    isActive: boolean;
    createdAt: string;
}

export async function createShortUrl(url: string, customAlias?: string, expiresAt?: string) {
    return request<UrlData>('/api/v1/urls', {
        method: 'POST',
        body: JSON.stringify({ url, customAlias, expiresAt }),
    });
}

export async function listUrls(page = 1, limit = 20) {
    return request<UrlData[]>(`/api/v1/urls?page=${page}&limit=${limit}`);
}

export async function getUrl(code: string) {
    return request<UrlData>(`/api/v1/urls/${code}`);
}

export async function deleteUrl(code: string) {
    return request<void>(`/api/v1/urls/${code}`, { method: 'DELETE' });
}

// ─── Auth Endpoints ───

export interface AuthData {
    user: { id: string; email: string; name: string | null; tier: string };
    accessToken: string;
}

export async function register(email: string, password: string, name?: string) {
    return request<AuthData>('/api/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, name }),
    });
}

export async function login(email: string, password: string) {
    return request<AuthData>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    });
}

// ─── Analytics Endpoints ───

export interface AnalyticsData {
    shortCode: string;
    totalClicks: number;
    createdAt: string;
}

export async function getAnalytics(code: string) {
    return request<AnalyticsData>(`/api/v1/analytics/${code}`);
}

// ─── Auth Helpers ───

export function saveAuth(data: AuthData) {
    localStorage.setItem('token', data.accessToken);
    localStorage.setItem('user', JSON.stringify(data.user));
}

export function getUser() {
    if (typeof window === 'undefined') return null;
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
}

export function isAuthenticated() {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem('token');
}

export function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
}
