import { createHash } from 'node:crypto';

import {
    mapLegacyPayloadToDbRecord,
    mapRecordRowToApiRecord
} from '../mappers/recordMapper.js';
import * as recordRepository from '../repositories/recordRepository.js';
import { AppError } from '../utils/http.js';
import { withRecordAccess } from './recordAccess.js';

export function getDataEtag(records) {
    return `"${createHash('sha256').update(JSON.stringify(records)).digest('hex')}"`;
}

export async function getUserData(userId) {
    return withRecordAccess(async () => {
        const rows = await recordRepository.findRecordsByUserId(userId);
        return rows.map(mapRecordRowToApiRecord);
    });
}

export async function getReviewBootstrap(userId, today) {
    return withRecordAccess(async () => {
        const { count, rows } = await recordRepository.findReviewBootstrapByUserId(userId, today);
        return { count, records: rows.map(mapRecordRowToApiRecord) };
    });
}

export async function replaceUserData(userId, records, expectedEtag) {
    if (!expectedEtag) {
        throw new AppError(428, '请先获取最新词库，并通过 If-Match 提交数据版本');
    }
    if (records.length === 0) {
        throw new AppError(400, '不能用空数组覆盖词库');
    }
    const dbRecords = records.map(record => mapLegacyPayloadToDbRecord(userId, record));
    await withRecordAccess(() => recordRepository.replaceUserRecords(userId, dbRecords, expectedEtag, getDataEtag));
    return { success: true };
}
