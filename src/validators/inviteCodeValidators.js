import { AppError } from '../utils/http.js';
import {
    ensurePlainObject,
    pickAllowedKeys,
    readBoolean,
    readInteger,
    readPositiveIntegerParam,
    readRequiredString
} from './helpers.js';

export function validateCreateInviteCodePayload(body) {
    ensurePlainObject(body);
    const input = pickAllowedKeys(body, ['code', 'maxUses'], '邀请码格式错误');

    return {
        code: readRequiredString(input.code, '邀请码', { maxLength: 128 }),
        maxUses: readInteger(input.maxUses, '邀请码次数', { min: 1, max: 999999 })
    };
}

export function validateInviteCodeIdParams(params) {
    return {
        id: readPositiveIntegerParam(params.id, '邀请码 ID')
    };
}

export function validateUpdateInviteCodePayload(body) {
    ensurePlainObject(body);
    const input = pickAllowedKeys(body, ['isActive', 'maxUses'], '邀请码格式错误');

    if (input.isActive === undefined && input.maxUses === undefined) {
        throw new AppError(400, '请提供需要更新的邀请码字段');
    }

    return {
        isActive: input.isActive === undefined ? undefined : readBoolean(input.isActive, '邀请码状态'),
        maxUses: input.maxUses === undefined
            ? undefined
            : readInteger(input.maxUses, '邀请码次数', { min: 1, max: 999999 })
    };
}
