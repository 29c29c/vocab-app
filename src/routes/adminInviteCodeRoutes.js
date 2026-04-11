import { Router } from 'express';

import { asyncHandler } from '../utils/asyncHandler.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import * as inviteCodeService from '../services/inviteCodeService.js';
import {
    validateCreateInviteCodePayload,
    validateInviteCodeIdParams,
    validateUpdateInviteCodePayload
} from '../validators/inviteCodeValidators.js';

export function createAdminInviteCodeRouter({ authenticateToken, jsonParsers, requireAdmin }) {
    const router = Router();

    router.get(
        '/admin/invite-codes',
        authenticateToken,
        requireAdmin,
        asyncHandler(async (_req, res) => {
            const result = await inviteCodeService.listInviteCodes();
            res.json(result);
        }, '获取邀请码失败')
    );

    router.post(
        '/admin/invite-codes',
        authenticateToken,
        requireAdmin,
        jsonParsers.small,
        validateBody(validateCreateInviteCodePayload),
        asyncHandler(async (req, res) => {
            const result = await inviteCodeService.createInviteCode(req.user.id, req.validatedBody);
            res.json(result);
        }, '创建邀请码失败')
    );

    router.patch(
        '/admin/invite-codes/:id',
        authenticateToken,
        requireAdmin,
        jsonParsers.small,
        validateParams(validateInviteCodeIdParams),
        validateBody(validateUpdateInviteCodePayload),
        asyncHandler(async (req, res) => {
            const result = await inviteCodeService.updateInviteCode(
                req.validatedParams.id,
                req.validatedBody
            );
            res.json(result);
        }, '更新邀请码失败')
    );

    router.delete(
        '/admin/invite-codes/:id',
        authenticateToken,
        requireAdmin,
        validateParams(validateInviteCodeIdParams),
        asyncHandler(async (req, res) => {
            const result = await inviteCodeService.deleteInviteCode(req.validatedParams.id);
            res.json(result);
        }, '删除邀请码失败')
    );

    return router;
}
