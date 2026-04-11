import { AppError } from '../utils/http.js';
import { isSupportedAiProvider } from '../shared/aiProviders.js';
import {
    pickAllowedKeys,
    readOptionalString
} from './helpers.js';

export function validateSettingsPayload(body) {
    const input = pickAllowedKeys(body, ['apiKey', 'dsBaseUrl', 'dsModel', 'provider'], '设置格式错误');
    const provider = input.provider ?? undefined;

    if (provider !== undefined && !isSupportedAiProvider(provider)) {
        throw new AppError(400, 'Provider 格式错误');
    }

    return {
        apiKey: input.apiKey === undefined ? undefined : readOptionalString(input.apiKey, 'API Key', { maxLength: 2048 }),
        dsBaseUrl: input.dsBaseUrl === undefined
            ? undefined
            : (readOptionalString(input.dsBaseUrl, 'AI 服务地址', { maxLength: 255 }) || ''),
        dsModel: input.dsModel === undefined
            ? undefined
            : (readOptionalString(input.dsModel, '模型名称', { maxLength: 120 }) || ''),
        provider
    };
}

export function validateApiKeyPayload(body) {
    const input = pickAllowedKeys(body, ['apiKey'], '设置格式错误');

    return {
        apiKey: readOptionalString(input.apiKey, 'API Key', { maxLength: 2048 }) || ''
    };
}
