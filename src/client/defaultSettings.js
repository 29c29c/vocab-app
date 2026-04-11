import {
    DEFAULT_AI_PROVIDER,
    getAiProviderPreset,
    isSupportedAiProvider
} from '../shared/aiProviders.js';

const defaultPreset = getAiProviderPreset(DEFAULT_AI_PROVIDER);

export const DEFAULT_APP_SETTINGS = {
    apiKey: '',
    dsBaseUrl: defaultPreset.baseUrl || '',
    dsModel: defaultPreset.model || '',
    provider: DEFAULT_AI_PROVIDER
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
        dsModel: typeof source.dsModel === 'string' && source.dsModel.trim()
            ? source.dsModel.trim()
            : (preset.model ?? DEFAULT_APP_SETTINGS.dsModel),
        provider
    };
}

export function hasAiConfig(settings) {
    return Boolean(settings?.apiKey?.trim());
}
