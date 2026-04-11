import { AppError } from '../utils/http.js';
import {
    pickAllowedKeys,
    readBooleanLike,
    readInteger,
    readNullableString,
    readOptionalString
} from './helpers.js';

function normalizeLegacyRecord(record) {
    const input = pickAllowedKeys(record, [
        'aiAnalysis',
        'aiImage',
        'customMeaning',
        'date',
        'mastered',
        'masteredDate',
        'needsReadingPractice',
        'nextReviewDate',
        'reading',
        'reviewStage',
        'sentence',
        'word'
    ]);

    return {
        aiAnalysis: readOptionalString(input.aiAnalysis, 'AI 分析'),
        aiImage: readOptionalString(input.aiImage, 'AI 图片'),
        customMeaning: readOptionalString(input.customMeaning, '自定义释义'),
        date: input.date === undefined || input.date === null ? null : readOptionalString(input.date, '日期', { maxLength: 64 }),
        mastered: input.mastered === undefined ? false : readBooleanLike(input.mastered, '掌握状态'),
        masteredDate: readNullableString(input.masteredDate, '掌握日期', { maxLength: 64 }),
        needsReadingPractice: input.needsReadingPractice === undefined
            ? false
            : readBooleanLike(input.needsReadingPractice, '朗读练习标记'),
        nextReviewDate: input.nextReviewDate === undefined || input.nextReviewDate === null
            ? null
            : readOptionalString(input.nextReviewDate, '下次复习日期', { maxLength: 64 }),
        reading: readOptionalString(input.reading, '音标'),
        reviewStage: input.reviewStage === undefined ? 0 : readInteger(input.reviewStage, '复习阶段', { max: 100000, min: 0 }),
        sentence: readOptionalString(input.sentence, '例句'),
        word: input.word === undefined || input.word === null ? null : readOptionalString(input.word, '单词', { maxLength: 255 })
    };
}

export function validateLegacyImportPayload(body) {
    if (!Array.isArray(body)) {
        throw new AppError(400, '格式错误');
    }

    return body.map(normalizeLegacyRecord);
}
