export const DEFAULT_APP_SETTINGS = {
    apiKey: '',
    dsBaseUrl: 'https://api.deepseek.com',
    dsModel: 'deepseek-chat',
    provider: 'deepseek'
};

export function normalizeAppSettings(input) {
    const source = input && typeof input === 'object' ? input : {};

    return {
        apiKey: typeof source.apiKey === 'string' ? source.apiKey : DEFAULT_APP_SETTINGS.apiKey,
        dsBaseUrl: typeof source.dsBaseUrl === 'string' && source.dsBaseUrl.trim()
            ? source.dsBaseUrl.trim()
            : DEFAULT_APP_SETTINGS.dsBaseUrl,
        dsModel: typeof source.dsModel === 'string' && source.dsModel.trim()
            ? source.dsModel.trim()
            : DEFAULT_APP_SETTINGS.dsModel,
        provider: source.provider === 'gemini' ? 'gemini' : DEFAULT_APP_SETTINGS.provider
    };
}

export function hasAiConfig(settings) {
    return Boolean(settings?.apiKey?.trim());
}
