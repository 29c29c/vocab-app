import * as userRepository from '../../src/repositories/userRepository.js';
import { normalizeAppSettings } from '../../src/client/defaultSettings.js';
import { getAiProviderPreset } from '../../src/shared/aiProviders.js';
import { AppError } from '../../src/utils/http.js';

const DEFAULT_AI_TIMEOUT_MS = 30000;

function parseSettings(settingsText) {
    if (!settingsText) return {};

    try {
        const parsed = JSON.parse(settingsText);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
        console.error('AI 设置解析失败:', error);
        return {};
    }
}

function isPrivateHostname(hostname) {
    const normalized = hostname.toLowerCase();

    if (normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1') {
        return true;
    }

    if (normalized.startsWith('10.') || normalized.startsWith('192.168.') || normalized.startsWith('169.254.')) {
        return true;
    }

    if (/^172\.(1[6-9]|2\d|3[01])\./.test(normalized)) {
        return true;
    }

    return false;
}

function normalizeBaseUrl(urlValue) {
    let parsedUrl;

    try {
        parsedUrl = new URL(urlValue);
    } catch {
        throw new AppError(400, 'AI 服务地址格式错误');
    }

    if (parsedUrl.protocol !== 'https:') {
        throw new AppError(400, 'AI 服务地址必须使用 HTTPS');
    }

    if (isPrivateHostname(parsedUrl.hostname)) {
        throw new AppError(400, 'AI 服务地址不允许使用内网地址');
    }

    parsedUrl.search = '';
    parsedUrl.hash = '';

    return `${parsedUrl.origin}${parsedUrl.pathname}`.replace(/\/$/, '');
}

async function readJsonResponse(response) {
    const rawText = await response.text();

    if (!rawText) {
        return {};
    }

    try {
        return JSON.parse(rawText);
    } catch {
        return { rawText };
    }
}

async function requestOpenAiCompatible(prompt, settings, responseFormat) {
    const preset = getAiProviderPreset(settings.provider);
    const baseUrl = normalizeBaseUrl(settings.dsBaseUrl || preset.baseUrl);
    const payload = {
        model: settings.dsModel || preset.model,
        messages: [{ role: 'user', content: prompt }]
    };

    if (responseFormat === 'json_object' && preset.supportsJsonMode) {
        payload.response_format = { type: 'json_object' };
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${settings.apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(DEFAULT_AI_TIMEOUT_MS)
    });

    const data = await readJsonResponse(response);
    if (!response.ok) {
        throw new AppError(502, data?.error?.message || data?.message || `${preset.label} 请求失败`);
    }

    return data?.choices?.[0]?.message?.content || data?.rawText || '';
}

async function requestGemini(prompt, settings, responseFormat) {
    const preset = getAiProviderPreset(settings.provider);
    const model = settings.dsModel || preset.model;
    const payload = {
        contents: [{ parts: [{ text: prompt }] }]
    };

    if (responseFormat === 'json_object') {
        payload.generationConfig = { responseMimeType: 'application/json' };
    }

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(settings.apiKey)}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(DEFAULT_AI_TIMEOUT_MS)
        }
    );

    const data = await readJsonResponse(response);
    if (!response.ok) {
        throw new AppError(502, data?.error?.message || `${preset.label} 请求失败`);
    }

    return data?.candidates?.[0]?.content?.parts?.[0]?.text || data?.rawText || '';
}

export async function generateAiContent(userId, { prompt, responseFormat }) {
    const user = await userRepository.findUserSettingsById(userId);
    const settings = normalizeAppSettings(parseSettings(user?.settings));
    const preset = getAiProviderPreset(settings.provider);

    if (!settings.apiKey) {
        throw new AppError(400, '请先在设置中配置 API Key');
    }

    if (preset.protocol === 'gemini') {
        return { content: await requestGemini(prompt, settings, responseFormat) };
    }

    return { content: await requestOpenAiCompatible(prompt, settings, responseFormat) };
}
