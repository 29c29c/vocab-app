import {
    mapCreatePayloadToDbRecord,
    mapInsertedRecordToApiRecord,
    mapUpdatePayloadToDbRecord
} from '../mappers/recordMapper.js';
import * as recordRepository from '../repositories/recordRepository.js';
import { AppError } from '../utils/http.js';

export async function createRecord(userId, payload) {
    const dbRecord = mapCreatePayloadToDbRecord(userId, payload);
    const result = await recordRepository.insertRecord(dbRecord);
    return mapInsertedRecordToApiRecord(result.lastID, dbRecord);
}

export async function updateRecord(userId, recordId, payload) {
    const dbRecord = mapUpdatePayloadToDbRecord(payload);
    const result = await recordRepository.updateRecordById({
        id: recordId,
        record: dbRecord,
        userId
    });

    if (result.changes === 0) {
        throw new AppError(404, '记录不存在或无权修改');
    }

    return { success: true };
}

export async function deleteRecord(userId, recordId) {
    const result = await recordRepository.deleteRecordById({ id: recordId, userId });
    if (result.changes === 0) {
        throw new AppError(404, '记录不存在或无权删除');
    }

    return { success: true };
}
