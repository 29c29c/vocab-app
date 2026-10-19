import { AppError } from '../utils/http.js';
import { isSupportedAiProvider } from '../shared/aiProviders.js';
import {
    readBooleanLike,
    readInteger,
    pickAllowedKeys,
    readOptionalString
} from './helpers.js';

export function validateSettingsPayload(body) {
    const input = pickAllowedKeys(body, [
        'apiKey',
        'dsBaseUrl',
        'dsModel',
        'provider',
        'masteredReviewEnabled',
        'masteredReviewDailyCount',
        'masteredReviewMinDays',
        'reviewShortcutEasy',
        'reviewShortcutForget',
        'reviewShortcutHard',
        'showReviewSentence'
    ], '设置格式错误');
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
        provider,
        masteredReviewEnabled: input.masteredReviewEnabled === undefined ? undefined
            : readBooleanLike(input.masteredReviewEnabled, '已掌握回归复习'),
        masteredReviewDailyCount: input.masteredReviewDailyCount === undefined ? undefined
            : readInteger(input.masteredReviewDailyCount, '每日回归数量', { min: 1, max: 1000 }),
        masteredReviewMinDays: input.masteredReviewMinDays === undefined ? undefined
            : readInteger(input.masteredReviewMinDays, '掌握后等待天数', { min: 0, max: 36500 }),
        reviewShortcutEasy: input.reviewShortcutEasy === undefined
            ? undefined
            : readOptionalString(input.reviewShortcutEasy, '记得快捷键', { maxLength: 8 }),
        reviewShortcutForget: input.reviewShortcutForget === undefined
            ? undefined
            : readOptionalString(input.reviewShortcutForget, '忘记快捷键', { maxLength: 8 }),
        reviewShortcutHard: input.reviewShortcutHard === undefined
            ? undefined
            : readOptionalString(input.reviewShortcutHard, '模糊快捷键', { maxLength: 8 }),
        showReviewSentence: input.showReviewSentence === undefined
            ? undefined
            : readBooleanLike(input.showReviewSentence, '复习例句显示')
    };
}

export function validateApiKeyPayload(body) {
    const input = pickAllowedKeys(body, ['apiKey'], '设置格式错误');

    return {
        apiKey: readOptionalString(input.apiKey, 'API Key', { maxLength: 2048 }) || ''
    };
}
