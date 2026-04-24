export const DEFAULT_AI_PROVIDER = 'deepseek';

const DEEPSEEK_MODEL_ALIASES = {
    'deepseek-chat': 'deepseek-v4-flash',
    'deepseek-reasoner': 'deepseek-v4-pro'
};

export const AI_PROVIDER_PRESETS = {
    deepseek: {
        id: 'deepseek',
        label: 'DeepSeek',
        protocol: 'openai-compatible',
        baseUrl: 'https://api.deepseek.com',
        model: 'deepseek-v4-flash',
        supportsJsonMode: true
    },
    openai: {
        id: 'openai',
        label: 'OpenAI (GPT)',
        protocol: 'openai-compatible',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4.1-mini',
        supportsJsonMode: true
    },
    gemini: {
        id: 'gemini',
        label: 'Google Gemini',
        protocol: 'gemini',
        model: 'gemini-2.5-flash',
        supportsJsonMode: true
    },
    openrouter: {
        id: 'openrouter',
        label: 'OpenRouter',
        protocol: 'openai-compatible',
        baseUrl: 'https://openrouter.ai/api/v1',
        model: 'openai/gpt-4o-mini',
        supportsJsonMode: false
    },
    qwen: {
        id: 'qwen',
        label: 'Qwen / DashScope',
        protocol: 'openai-compatible',
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        model: 'qwen-plus',
        supportsJsonMode: false
    },
    siliconflow: {
        id: 'siliconflow',
        label: 'SiliconFlow',
        protocol: 'openai-compatible',
        baseUrl: 'https://api.siliconflow.cn/v1',
        model: 'Qwen/Qwen3-32B',
        supportsJsonMode: false
    }
};

export const AI_PROVIDER_OPTIONS = Object.values(AI_PROVIDER_PRESETS).map(({ id, label }) => ({
    value: id,
    label
}));

export function isSupportedAiProvider(provider) {
    return typeof provider === 'string' && Object.hasOwn(AI_PROVIDER_PRESETS, provider);
}

export function getAiProviderPreset(provider) {
    if (isSupportedAiProvider(provider)) {
        return AI_PROVIDER_PRESETS[provider];
    }

    return AI_PROVIDER_PRESETS[DEFAULT_AI_PROVIDER];
}

export function normalizeAiModel(provider, model) {
    const preset = getAiProviderPreset(provider);
    const trimmedModel = typeof model === 'string' ? model.trim() : '';

    if (!trimmedModel) {
        return preset.model ?? '';
    }

    if (preset.id === 'deepseek') {
        return DEEPSEEK_MODEL_ALIASES[trimmedModel] ?? trimmedModel;
    }

    return trimmedModel;
}
