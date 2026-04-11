import * as userRepository from '../repositories/userRepository.js';

export async function getSettings(userId) {
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

export async function saveSettings(userId, settings) {
    await userRepository.updateUserSettings(userId, JSON.stringify(settings));
    return { success: true };
}
