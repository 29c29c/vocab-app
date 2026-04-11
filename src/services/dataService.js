import {
    mapLegacyPayloadToDbRecord,
    mapRecordRowToApiRecord
} from '../mappers/recordMapper.js';
import * as recordRepository from '../repositories/recordRepository.js';

export async function getUserData(userId) {
    const rows = await recordRepository.findRecordsByUserId(userId);
    return rows.map(mapRecordRowToApiRecord);
}

export async function replaceUserData(userId, records) {
    const dbRecords = records.map(record => mapLegacyPayloadToDbRecord(userId, record));
    await recordRepository.replaceUserRecords(userId, dbRecords);
    return { success: true };
}
