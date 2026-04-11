import { Router } from 'express';

import { asyncHandler } from '../utils/asyncHandler.js';
import { validateBody } from '../middleware/validate.js';
import * as settingsService from '../services/settingsService.js';
import { validateSettingsPayload } from '../validators/settingsValidators.js';

export function createSettingsRouter({ authenticateToken, jsonParsers }) {
    const router = Router();

    router.get(
        '/settings',
        authenticateToken,
        asyncHandler(async (req, res) => {
            const settings = await settingsService.getSettings(req.user.id);
            res.json(settings);
        }, '获取设置失败')
    );

    router.post(
        '/settings',
        authenticateToken,
        jsonParsers.small,
        validateBody(validateSettingsPayload),
        asyncHandler(async (req, res) => {
            const result = await settingsService.saveSettings(req.user.id, req.validatedBody);
            res.json(result);
        }, '保存设置失败')
    );

    return router;
}
