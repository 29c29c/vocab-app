import { AppError } from '../utils/http.js';
import {
    pickAllowedKeys,
    readOptionalString
} from './helpers.js';

export function validateSettingsPayload(body) {
    const input = pickAllowedKeys(body, ['apiKey', 'dsBaseUrl', 'dsModel', 'provider'], '设置格式错误');
    const provider = input.provider ?? 'deepseek';

    if (!['deepseek', 'gemini'].includes(provider)) {
        throw new AppError(400, 'Provider 格式错误');
    }

    return {
        apiKey: readOptionalString(input.apiKey, 'API Key', { maxLength: 2048 }),
        dsBaseUrl: readOptionalString(input.dsBaseUrl, 'AI 服务地址', { maxLength: 255 }) || 'https://api.deepseek.com',
        dsModel: readOptionalString(input.dsModel, '模型名称', { maxLength: 120 }) || 'deepseek-chat',
        provider
    };
}
