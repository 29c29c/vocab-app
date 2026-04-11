import * as userRepository from '../../src/repositories/userRepository.js';
import { AppError } from '../../src/utils/http.js';

const DEFAULT_PROVIDER = 'deepseek';
const DEFAULT_DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
const DEFAULT_DEEPSEEK_MODEL = 'deepseek-chat';
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

function normalizeAiSettings(rawSettings) {
    const provider = rawSettings.provider === 'gemini' ? 'gemini' : DEFAULT_PROVIDER;
    const apiKey = typeof rawSettings.apiKey === 'string' ? rawSettings.apiKey.trim() : '';
    const dsBaseUrl = typeof rawSettings.dsBaseUrl === 'string' && rawSettings.dsBaseUrl.trim()
        ? rawSettings.dsBaseUrl.trim()
        : DEFAULT_DEEPSEEK_BASE_URL;
    const dsModel = typeof rawSettings.dsModel === 'string' && rawSettings.dsModel.trim()
        ? rawSettings.dsModel.trim()
        : DEFAULT_DEEPSEEK_MODEL;

    return { apiKey, dsBaseUrl, dsModel, provider };
}

function validateDeepSeekBaseUrl(urlValue) {
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

    return parsedUrl.origin;
}

async function requestGemini(prompt, apiKey) {
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
            signal: AbortSignal.timeout(DEFAULT_AI_TIMEOUT_MS)
        }
    );

    const data = await response.json();
    if (!response.ok) {
        throw new AppError(502, data?.error?.message || 'Gemini 请求失败');
    }

    return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function requestDeepSeek(prompt, settings, responseFormat) {
    const baseUrl = validateDeepSeekBaseUrl(settings.dsBaseUrl);
    const payload = {
        model: settings.dsModel,
        messages: [{ role: 'user', content: prompt }]
    };

    if (responseFormat === 'json_object') {
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

    const data = await response.json();
    if (!response.ok) {
        throw new AppError(502, data?.error?.message || 'DeepSeek 请求失败');
    }

    return data?.choices?.[0]?.message?.content || '';
}

export async function generateAiContent(userId, { prompt, responseFormat }) {
    const user = await userRepository.findUserSettingsById(userId);
    const settings = normalizeAiSettings(parseSettings(user?.settings));

    if (!settings.apiKey) {
        throw new AppError(400, '请先在设置中配置 API Key');
    }

    if (settings.provider === 'gemini') {
        return { content: await requestGemini(prompt, settings.apiKey) };
    }

    return { content: await requestDeepSeek(prompt, settings, responseFormat) };
}
