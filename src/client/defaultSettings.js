import {
    DEFAULT_AI_PROVIDER,
    getAiProviderPreset,
    isSupportedAiProvider,
    normalizeAiModel
} from '../shared/aiProviders.js';

const defaultPreset = getAiProviderPreset(DEFAULT_AI_PROVIDER);

function normalizeShortcutKey(value, fallback = '') {
    if (typeof value !== 'string') {
        return fallback;
    }

    const trimmed = value.trim().toUpperCase();
    if (!trimmed) {
        return '';
    }

    return trimmed.slice(0, 1);
}

export const DEFAULT_APP_SETTINGS = {
    apiKey: '',
    dsBaseUrl: defaultPreset.baseUrl || '',
    dsModel: defaultPreset.model || '',
    provider: DEFAULT_AI_PROVIDER,
    reviewShortcutEasy: 'D',
    reviewShortcutForget: 'A',
    reviewShortcutHard: 'S',
    showReviewSentence: true
};

export function normalizeAppSettings(input) {
    const source = input && typeof input === 'object' ? input : {};
    const provider = isSupportedAiProvider(source.provider) ? source.provider : DEFAULT_APP_SETTINGS.provider;
    const preset = getAiProviderPreset(provider);

    return {
        apiKey: typeof source.apiKey === 'string' ? source.apiKey : DEFAULT_APP_SETTINGS.apiKey,
        dsBaseUrl: typeof source.dsBaseUrl === 'string' && source.dsBaseUrl.trim()
            ? source.dsBaseUrl.trim()
            : (preset.baseUrl ?? ''),
        dsModel: normalizeAiModel(provider, source.dsModel || preset.model || DEFAULT_APP_SETTINGS.dsModel),
        provider,
        reviewShortcutEasy: normalizeShortcutKey(source.reviewShortcutEasy, DEFAULT_APP_SETTINGS.reviewShortcutEasy),
        reviewShortcutForget: normalizeShortcutKey(source.reviewShortcutForget, DEFAULT_APP_SETTINGS.reviewShortcutForget),
        reviewShortcutHard: normalizeShortcutKey(source.reviewShortcutHard, DEFAULT_APP_SETTINGS.reviewShortcutHard),
        showReviewSentence: typeof source.showReviewSentence === 'boolean'
            ? source.showReviewSentence
            : DEFAULT_APP_SETTINGS.showReviewSentence
    };
}

export function hasAiConfig(settings) {
    return Boolean(settings?.apiKey?.trim());
}
