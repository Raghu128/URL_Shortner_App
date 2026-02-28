import { Router } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { rateLimiter } from '../../middleware/rateLimiter.middleware';
import { validateRequest } from '../../middleware/validateRequest.middleware';
import { registerSchema, loginSchema } from './auth.schema';

// ─── Dependency Injection ───
const authRepository = new AuthRepository();
const authService = new AuthService(authRepository);
const authController = new AuthController(authService);

// ─── Routes (/api/v1/auth) ───
export const authRouter = Router();

authRouter.post(
    '/register',
    rateLimiter(5, 60), // 5 registrations per minute
    validateRequest(registerSchema),
    authController.register,
);

authRouter.post(
    '/login',
    rateLimiter(10, 60), // 10 login attempts per minute
    validateRequest(loginSchema),
    authController.login,
);
