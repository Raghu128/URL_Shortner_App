import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { sendCreated, sendSuccess } from '../../common/utils/responseHelper';

/**
 * Auth Controller — HTTP layer for authentication endpoints.
 */
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    /**
     * POST /api/v1/auth/register
     */
    register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { email, password, name } = req.body;
            const result = await this.authService.register({ email, password, name });
            sendCreated(res, result);
        } catch (error) {
            next(error);
        }
    };

    /**
     * POST /api/v1/auth/login
     */
    login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { email, password } = req.body;
            const result = await this.authService.login({ email, password });
            sendSuccess(res, result);
        } catch (error) {
            next(error);
        }
    };
}
