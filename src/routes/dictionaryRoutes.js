import { Router } from 'express';

import { lookupDictionary } from '../../server/services/dictionaryService.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateDictionaryLookupPayload } from '../validators/dictionaryValidators.js';

export function createDictionaryRouter({ authenticateToken, jsonParsers }) {
    const router = Router();

    router.post(
        '/dictionary/lookup',
        authenticateToken,
        jsonParsers.small,
        validateBody(validateDictionaryLookupPayload),
        asyncHandler(async (req, res) => {
            const result = await lookupDictionary(req.validatedBody);
            res.json(result);
        }, '词典查询失败')
    );

    return router;
}
