import { AppError } from '../utils/http.js';
import { pickAllowedKeys, readRequiredString } from './helpers.js';

const ALLOWED_RESPONSE_FORMATS = new Set(['text', 'json_object']);

export function validateAiCompletionPayload(body) {
    const input = pickAllowedKeys(body, ['prompt', 'responseFormat']);

    const prompt = readRequiredString(input.prompt, '提示词', {
        maxLength: 12000,
        trim: false
    });

    const responseFormat = input.responseFormat ?? 'text';
    if (!ALLOWED_RESPONSE_FORMATS.has(responseFormat)) {
        throw new AppError(400, '响应格式错误');
    }

    return { prompt, responseFormat };
}
