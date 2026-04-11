import { all, get, run, withTransaction } from '../db/index.js';

export async function countInviteCodes() {
    const row = await get('SELECT COUNT(*) AS count FROM invite_codes');
    return row?.count ?? 0;
}

export async function findInviteCodeByCode(code) {
    return get('SELECT * FROM invite_codes WHERE code = ?', [code]);
}

export async function findInviteCodeById(id) {
    return get('SELECT * FROM invite_codes WHERE id = ?', [id]);
}

export async function listInviteCodes() {
    return all(
        `SELECT
            id,
            code,
            max_uses,
            used_count,
            is_active,
            created_by_user_id,
            created_at
         FROM invite_codes
         ORDER BY id DESC`
    );
}

export async function createInviteCode({ code, createdByUserId, maxUses }) {
    return run(
        `INSERT INTO invite_codes (code, max_uses, used_count, is_active, created_by_user_id)
         VALUES (?, ?, 0, 1, ?)`,
        [code, maxUses, createdByUserId]
    );
}

export async function updateInviteCodeById({ id, isActive, maxUses }) {
    const updates = [];
    const params = [];

    if (isActive !== undefined) {
        updates.push('is_active = ?');
        params.push(isActive ? 1 : 0);
    }

    if (maxUses !== undefined) {
        updates.push('max_uses = ?');
        params.push(maxUses);
    }

    if (updates.length === 0) {
        return { changes: 0 };
    }

    params.push(id);

    return run(`UPDATE invite_codes SET ${updates.join(', ')} WHERE id = ?`, params);
}

export async function deleteInviteCodeById(id) {
    return run('DELETE FROM invite_codes WHERE id = ?', [id]);
}

export async function createUserWithInviteCode({
    inviteCode,
    passwordHash,
    username,
    isAdminBootstrap
}) {
    try {
        return await withTransaction(async tx => {
            const existingUser = await tx.get('SELECT id FROM users WHERE username = ?', [username]);
            if (existingUser) {
                const error = new Error('用户名已存在');
                error.code = 'USERNAME_EXISTS';
                throw error;
            }

            let targetInviteCode = null;

            if (!isAdminBootstrap) {
                targetInviteCode = await tx.get('SELECT * FROM invite_codes WHERE code = ?', [inviteCode]);
                if (
                    !targetInviteCode ||
                    !targetInviteCode.is_active ||
                    targetInviteCode.used_count >= targetInviteCode.max_uses
                ) {
                    const error = new Error('邀请码错误');
                    error.code = 'INVITE_CODE_INVALID';
                    throw error;
                }
            }

            const userResult = await tx.run(
                'INSERT INTO users (username, password, settings) VALUES (?, ?, ?)',
                [username, passwordHash, '{}']
            );

            if (!isAdminBootstrap) {
                const inviteUpdateResult = await tx.run(
                    `UPDATE invite_codes
                     SET used_count = used_count + 1
                     WHERE id = ? AND is_active = 1 AND used_count < max_uses`,
                    [targetInviteCode.id]
                );

                if (inviteUpdateResult.changes === 0) {
                    const error = new Error('邀请码错误');
                    error.code = 'INVITE_CODE_INVALID';
                    throw error;
                }
            }

            return { lastID: userResult.lastID };
        });
    } catch (error) {
        if (
            error?.code === 'USERNAME_EXISTS' ||
            error?.message?.includes('UNIQUE constraint failed: users.username')
        ) {
            return { failure: '用户名已存在' };
        }

        if (error?.code === 'INVITE_CODE_INVALID') {
            return { failure: '邀请码错误' };
        }

        throw error;
    }
}
