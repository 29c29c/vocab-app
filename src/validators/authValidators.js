import { AppError } from '../utils/http.js';
import {
    ensurePlainObject,
    pickAllowedKeys,
    readOptionalString,
    readRequiredString
} from './helpers.js';

export function validateRegisterPayload(body) {
    ensurePlainObject(body);
    const input = pickAllowedKeys(body, ['inviteCode', 'password', 'username']);

    if (input.username === undefined || input.password === undefined) {
        throw new AppError(400, '请输入用户名和密码');
    }

    return {
        inviteCode: input.inviteCode === undefined
            ? ''
            : readOptionalString(input.inviteCode, '邀请码', { maxLength: 128 }),
        password: readRequiredString(input.password, '密码', { maxLength: 128, trim: false }),
        username: readRequiredString(input.username, '用户名', { maxLength: 64, trim: false })
    };
}

export function validateLoginPayload(body) {
    ensurePlainObject(body);
    const input = pickAllowedKeys(body, ['password', 'username']);

    if (input.username === undefined || input.password === undefined) {
        throw new AppError(400, '请输入用户名和密码');
    }

    return {
        password: readRequiredString(input.password, '密码', { maxLength: 128, trim: false }),
        username: readRequiredString(input.username, '用户名', { maxLength: 64, trim: false })
    };
}
