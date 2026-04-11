import * as inviteCodeRepository from '../repositories/inviteCodeRepository.js';
import { AppError } from '../utils/http.js';

function mapInviteCodeRow(row) {
    return {
        code: row.code,
        createdAt: row.created_at,
        createdByUserId: row.created_by_user_id,
        id: row.id,
        isActive: Boolean(row.is_active),
        maxUses: row.max_uses,
        usedCount: row.used_count
    };
}

export async function listInviteCodes() {
    const rows = await inviteCodeRepository.listInviteCodes();
    return rows.map(mapInviteCodeRow);
}

export async function createInviteCode(adminUserId, { code, maxUses }) {
    const existing = await inviteCodeRepository.findInviteCodeByCode(code);
    if (existing) {
        throw new AppError(400, '邀请码已存在');
    }

    const result = await inviteCodeRepository.createInviteCode({
        code,
        createdByUserId: adminUserId,
        maxUses
    });

    const created = await inviteCodeRepository.findInviteCodeById(result.lastID);
    return mapInviteCodeRow(created);
}

export async function updateInviteCode(inviteCodeId, payload) {
    const existing = await inviteCodeRepository.findInviteCodeById(inviteCodeId);
    if (!existing) {
        throw new AppError(404, '邀请码不存在');
    }

    if (payload.maxUses !== undefined && payload.maxUses < existing.used_count) {
        throw new AppError(400, '邀请码次数不能小于已使用次数');
    }

    const result = await inviteCodeRepository.updateInviteCodeById({
        id: inviteCodeId,
        isActive: payload.isActive,
        maxUses: payload.maxUses
    });

    if (result.changes === 0) {
        throw new AppError(404, '邀请码不存在');
    }

    const updated = await inviteCodeRepository.findInviteCodeById(inviteCodeId);
    return mapInviteCodeRow(updated);
}

export async function deleteInviteCode(inviteCodeId) {
    const result = await inviteCodeRepository.deleteInviteCodeById(inviteCodeId);
    if (result.changes === 0) {
        throw new AppError(404, '邀请码不存在');
    }

    return { success: true };
}
