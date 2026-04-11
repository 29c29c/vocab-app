import { Router } from 'express';

import { asyncHandler } from '../utils/asyncHandler.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import * as recordsService from '../services/recordsService.js';
import {
    validateCreateRecordPayload,
    validateRecordIdParams,
    validateUpdateRecordPayload
} from '../validators/recordValidators.js';

export function createRecordRouter({ authenticateToken, jsonParsers }) {
    const router = Router();

    router.post(
        '/records',
        authenticateToken,
        jsonParsers.small,
        validateBody(validateCreateRecordPayload),
        asyncHandler(async (req, res) => {
            const record = await recordsService.createRecord(req.user.id, req.validatedBody);
            res.json(record);
        }, '添加失败')
    );

    router.put(
        '/records/:id',
        authenticateToken,
        jsonParsers.small,
        validateParams(validateRecordIdParams),
        validateBody(validateUpdateRecordPayload),
        asyncHandler(async (req, res) => {
            const result = await recordsService.updateRecord(
                req.user.id,
                req.validatedParams.id,
                req.validatedBody
            );
            res.json(result);
        }, '更新失败')
    );

    router.delete(
        '/records/:id',
        authenticateToken,
        validateParams(validateRecordIdParams),
        asyncHandler(async (req, res) => {
            const result = await recordsService.deleteRecord(req.user.id, req.validatedParams.id);
            res.json(result);
        }, '删除失败')
    );

    return router;
}
