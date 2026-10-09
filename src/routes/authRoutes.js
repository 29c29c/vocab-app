import { Router } from 'express';

import { asyncHandler } from '../utils/asyncHandler.js';
import { validateBody } from '../middleware/validate.js';
import * as authService from '../services/authService.js';
import { validateLoginPayload, validateRegisterPayload } from '../validators/authValidators.js';

export function createAuthRouter({ authenticateToken, config, jsonParsers, loginRateLimiter, registerRateLimiter }) {
    const router = Router();

    router.post(
        '/register',
        registerRateLimiter,
        jsonParsers.small,
        validateBody(validateRegisterPayload),
        asyncHandler(async (req, res) => {
            const result = await authService.registerUser(req.validatedBody, config);
            res.json(result);
        }, '注册失败')
    );

    router.post(
        '/login',
        loginRateLimiter,
        jsonParsers.small,
        validateBody(validateLoginPayload),
        asyncHandler(async (req, res) => {
            const result = await authService.loginUser(req.validatedBody, config);
            res.json(result);
        }, '登录失败')
    );

    router.post(
        '/logout',
        authenticateToken,
        asyncHandler(async (req, res) => {
            res.json(await authService.logoutUser(req.user));
        }, '退出登录失败')
    );

    return router;
}
