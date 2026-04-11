import { AppError } from '../utils/http.js';

export function isPlainObject(value) {
    return Object.prototype.toString.call(value) === '[object Object]';
}

export function ensurePlainObject(value, message = '格式错误') {
    if (!isPlainObject(value)) {
        throw new AppError(400, message);
    }
    return value;
}

export function pickAllowedKeys(value, allowedKeys, message = '格式错误') {
    const input = ensurePlainObject(value, message);
    const result = {};

    for (const key of allowedKeys) {
        if (Object.hasOwn(input, key)) {
            result[key] = input[key];
        }
    }

    return result;
}

export function readRequiredString(value, fieldName, { maxLength = 1000, trim = true } = {}) {
    if (typeof value !== 'string') {
        throw new AppError(400, `${fieldName}格式错误`);
    }

    const normalized = trim ? value.trim() : value;
    if (!normalized) {
        throw new AppError(400, `${fieldName}不能为空`);
    }

    if (normalized.length > maxLength) {
        throw new AppError(400, `${fieldName}长度不能超过 ${maxLength} 个字符`);
    }

    return normalized;
}

export function readOptionalString(value, fieldName, { maxLength = 50000 } = {}) {
    if (value === undefined) return '';
    if (value === null) return '';
    if (typeof value !== 'string') {
        throw new AppError(400, `${fieldName}格式错误`);
    }
    if (value.length > maxLength) {
        throw new AppError(400, `${fieldName}长度不能超过 ${maxLength} 个字符`);
    }
    return value;
}

export function readNullableString(value, fieldName, { maxLength = 50000 } = {}) {
    if (value === undefined || value === null) {
        return null;
    }
    if (typeof value !== 'string') {
        throw new AppError(400, `${fieldName}格式错误`);
    }
    if (value.length > maxLength) {
        throw new AppError(400, `${fieldName}长度不能超过 ${maxLength} 个字符`);
    }
    return value;
}

export function readBoolean(value, fieldName) {
    if (typeof value !== 'boolean') {
        throw new AppError(400, `${fieldName}格式错误`);
    }
    return value;
}

export function readBooleanLike(value, fieldName) {
    if (typeof value === 'boolean') {
        return value;
    }

    if (value === 1) {
        return true;
    }

    if (value === 0) {
        return false;
    }

    throw new AppError(400, `${fieldName}格式错误`);
}

export function readInteger(value, fieldName, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
    if (!Number.isInteger(value) || value < min || value > max) {
        throw new AppError(400, `${fieldName}格式错误`);
    }
    return value;
}

export function readPositiveIntegerParam(value, fieldName = 'ID') {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new AppError(400, `${fieldName}格式错误`);
    }
    return parsed;
}

export function sanitizeJsonValue(value, fieldName = 'settings', depth = 0) {
    if (depth > 10) {
        throw new AppError(400, `${fieldName}嵌套层级过深`);
    }

    if (
        value === null ||
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
    ) {
        return value;
    }

    if (Array.isArray(value)) {
        return value.map(item => sanitizeJsonValue(item, fieldName, depth + 1));
    }

    if (isPlainObject(value)) {
        const result = {};
        for (const [key, nestedValue] of Object.entries(value)) {
            result[key] = sanitizeJsonValue(nestedValue, fieldName, depth + 1);
        }
        return result;
    }

    throw new AppError(400, `${fieldName}格式错误`);
}
