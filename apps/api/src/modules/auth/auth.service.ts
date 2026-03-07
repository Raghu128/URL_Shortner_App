import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AuthRepository } from './auth.repository';
import { RegisterDto, LoginDto, AuthResponse } from './auth.types';
import { ConflictError, UnauthorizedError } from '../../common/errors';
import { config } from '../../config';
import { logger } from '../../config/logger';

/**
 * Auth Service — handles registration, login, and token generation.
 */
export class AuthService {
    constructor(private readonly authRepository: AuthRepository) { }

    /**
     * Register a new user.
     */
    async register(dto: RegisterDto): Promise<AuthResponse> {
        // Check for existing user
        const existing = await this.authRepository.findByEmail(dto.email);
        if (existing) {
            throw new ConflictError('An account with this email already exists');
        }

        // Hash password
        const passwordHash = await bcrypt.hash(dto.password, config.auth.bcryptSaltRounds);

        // Create user on primary
        const user = await this.authRepository.create({
            email: dto.email,
            passwordHash,
            name: dto.name,
        });

        // Generate JWT
        const accessToken = this.generateToken(user.id, user.email, user.tier);

        logger.info({ userId: Number(user.id), email: user.email }, 'User registered');

        return {
            user: {
                id: user.id.toString(),
                email: user.email,
                name: user.name,
                tier: user.tier,
            },
            accessToken,
        };
    }

    /**
     * Login an existing user.
     */
    async login(dto: LoginDto): Promise<AuthResponse> {
        const user = await this.authRepository.findByEmail(dto.email);
        if (!user) {
            throw new UnauthorizedError('Invalid email or password');
        }

        const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
        if (!isPasswordValid) {
            throw new UnauthorizedError('Invalid email or password');
        }

        const accessToken = this.generateToken(user.id, user.email, user.tier);

        logger.info({ userId: Number(user.id) }, 'User logged in');

        return {
            user: {
                id: user.id.toString(),
                email: user.email,
                name: user.name,
                tier: user.tier,
            },
            accessToken,
        };
    }

    /**
     * Generate a JWT token.
     */
    private generateToken(userId: bigint, email: string, tier: string): string {
        const options: jwt.SignOptions = {
            expiresIn: config.auth.jwtExpiresIn as jwt.SignOptions['expiresIn'],
        };
        return jwt.sign(
            { userId: userId.toString(), email, tier },
            config.auth.jwtSecret,
            options,
        );
    }
}
