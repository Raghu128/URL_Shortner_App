/** DTO for user registration */
export interface RegisterDto {
    email: string;
    password: string;
    name?: string;
}

/** DTO for user login */
export interface LoginDto {
    email: string;
    password: string;
}

/** Auth response containing JWT tokens */
export interface AuthResponse {
    user: {
        id: string;
        email: string;
        name: string | null;
        tier: string;
    };
    accessToken: string;
}
