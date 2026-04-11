import { get, run } from '../db/index.js';

export async function findUserByUsername(username) {
    return get('SELECT * FROM users WHERE username = ?', [username]);
}

export async function createUser({ username, passwordHash }) {
    return run(
        'INSERT INTO users (username, password, settings) VALUES (?, ?, ?)',
        [username, passwordHash, '{}']
    );
}

export async function findUserSettingsById(userId) {
    return get('SELECT settings FROM users WHERE id = ?', [userId]);
}

export async function updateUserSettings(userId, settingsJson) {
    return run('UPDATE users SET settings = ? WHERE id = ?', [settingsJson, userId]);
}
