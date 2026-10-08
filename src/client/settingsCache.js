import { DEFAULT_APP_SETTINGS, normalizeAppSettings } from './defaultSettings.js';

const SETTINGS_CACHE_PREFIX = 'smart_vocab_settings_v3:';

export function readSettingsCache(accountId) {
    if (!accountId) return { ...DEFAULT_APP_SETTINGS };
    try {
        const raw = localStorage.getItem(`${SETTINGS_CACHE_PREFIX}${accountId}`);
        if (!raw) return { ...DEFAULT_APP_SETTINGS };
        return normalizeAppSettings(JSON.parse(raw));
    } catch {
        return { ...DEFAULT_APP_SETTINGS };
    }
}

export function writeSettingsCache(accountId, settings) {
    if (!accountId) return;
    const normalized = normalizeAppSettings(settings);
    const safeCache = {
        ...normalized,
        apiKey: ''
    };

    try {
        localStorage.setItem(`${SETTINGS_CACHE_PREFIX}${accountId}`, JSON.stringify(safeCache));
    } catch {
        // Server settings remain authoritative if the browser declines local caching.
    }
}
