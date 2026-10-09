import { get, run } from '../db/index.js';

export async function isTokenRevoked(jti) {
    const row = await get('SELECT 1 FROM revoked_tokens WHERE jti = ?', [jti]);
    return Boolean(row);
}

export async function revokeToken(jti, expiresAt) {
    await run('INSERT OR IGNORE INTO revoked_tokens (jti, expires_at) VALUES (?, ?)', [jti, expiresAt]);
    await run('DELETE FROM revoked_tokens WHERE expires_at <= ?', [Math.floor(Date.now() / 1000)]);
}
