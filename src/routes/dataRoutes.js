import { Router } from 'express';

import { asyncHandler } from '../utils/asyncHandler.js';
import { validateBody } from '../middleware/validate.js';
import * as dataService from '../services/dataService.js';
import { validateLegacyImportPayload } from '../validators/dataValidators.js';

export function createDataRouter({ authenticateToken, jsonParsers }) {
    const router = Router();

    router.get(
        '/data',
        authenticateToken,
        asyncHandler(async (req, res) => {
            const records = await dataService.getUserData(req.user.id);
            res.json(records);
        }, '获取数据失败')
    );

    router.post(
        '/data',
        authenticateToken,
        jsonParsers.large,
        validateBody(validateLegacyImportPayload),
        asyncHandler(async (req, res) => {
            const result = await dataService.replaceUserData(req.user.id, req.validatedBody);
            res.json(result);
        }, '保存失败')
    );

    return router;
}
