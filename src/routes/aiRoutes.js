import { Router } from 'express';

import { asyncHandler } from '../utils/asyncHandler.js';
import { validateBody } from '../middleware/validate.js';
import { validateAiCompletionPayload } from '../validators/aiValidators.js';
import { generateAiContent } from '../../server/services/aiService.js';

export function createAiRouter({ authenticateToken, jsonParsers }) {
    const router = Router();

    router.post(
        '/ai/complete',
        authenticateToken,
        jsonParsers.small,
        validateBody(validateAiCompletionPayload),
        asyncHandler(async (req, res) => {
            const result = await generateAiContent(req.user.id, req.validatedBody);
            res.json(result);
        }, 'AI 请求失败')
    );

    return router;
}
