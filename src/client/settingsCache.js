import { DEFAULT_APP_SETTINGS, normalizeAppSettings } from './defaultSettings.js';

const SETTINGS_CACHE_KEY = 'smart_vocab_settings_v2';

export function readSettingsCache() {
    try {
        const raw = localStorage.getItem(SETTINGS_CACHE_KEY);
        if (!raw) return { ...DEFAULT_APP_SETTINGS };
        return normalizeAppSettings(JSON.parse(raw));
    } catch {
        return { ...DEFAULT_APP_SETTINGS };
    }
}

export function writeSettingsCache(settings) {
    const normalized = normalizeAppSettings(settings);
    const safeCache = {
        ...normalized,
        apiKey: ''
    };

    localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(safeCache));
}
