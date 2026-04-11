import * as userRepository from '../repositories/userRepository.js';
import { normalizeAppSettings } from '../client/defaultSettings.js';

async function readSettings(userId) {
    const user = await userRepository.findUserSettingsById(userId);
    if (!user || !user.settings) {
        return {};
    }

    try {
        return JSON.parse(user.settings);
    } catch (error) {
        console.error('用户设置 JSON 解析失败:', error);
        return {};
    }
}

export async function getSettings(userId) {
    return normalizeAppSettings(await readSettings(userId));
}

export async function saveSettings(userId, partialSettings) {
    const currentSettings = normalizeAppSettings(await readSettings(userId));
    const nextSettings = normalizeAppSettings({
        ...currentSettings,
        ...Object.fromEntries(Object.entries(partialSettings).filter(([, value]) => value !== undefined))
    });

    await userRepository.updateUserSettings(userId, JSON.stringify(nextSettings));
    return { success: true, settings: nextSettings };
}

export async function saveApiKey(userId, apiKey) {
    const currentSettings = normalizeAppSettings(await readSettings(userId));
    const nextSettings = normalizeAppSettings({
        ...currentSettings,
        apiKey
    });

    await userRepository.updateUserSettings(userId, JSON.stringify(nextSettings));
    return { success: true };
}
