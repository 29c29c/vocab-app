import { AppError } from '../utils/http.js';
import {
    pickAllowedKeys,
    readBooleanLike,
    readInteger,
    readNullableString,
    readOptionalString,
    readRequiredString
} from './helpers.js';

const ALLOWED_CREATION_SOURCES = new Set(['manual', 'article', 'writing', 'import', 'batch']);

function readCreationSource(value) {
    if (value === undefined || value === null || value === '') {
        return 'manual';
    }

    const normalized = readRequiredString(value, '记录来源', { maxLength: 32 });
    if (!ALLOWED_CREATION_SOURCES.has(normalized)) {
        throw new AppError(400, '记录来源格式错误');
    }

    return normalized;
}

function normalizeLegacyRecord(record) {
    const input = pickAllowedKeys(record, [
        'aiAnalysis',
        'aiImage',
        'createdAt',
        'creationSource',
        'customMeaning',
        'date',
        'dictionaryMeaning',
        'focusLastReviewDate',
        'focusRecoveryStreak',
        'forgetCount',
        'hardCount',
        'isFocusReview',
        'mastered',
        'masteredDate',
        'needsReadingPractice',
        'nextReviewDate',
        'reading',
        'reviewStage',
        'sameDayReviewDate',
        'sameDayReviewDone',
        'sameDayReviewTarget',
        'sentence',
        'word'
    ]);

    return {
        aiAnalysis: readOptionalString(input.aiAnalysis, 'AI 分析'),
        aiImage: readOptionalString(input.aiImage, 'AI 图片'),
        createdAt: input.createdAt === undefined || input.createdAt === null
            ? null
            : readOptionalString(input.createdAt, '创建时间', { maxLength: 128 }),
        creationSource: readCreationSource(input.creationSource),
        customMeaning: readOptionalString(input.customMeaning, '自定义释义'),
        date: input.date === undefined || input.date === null ? null : readOptionalString(input.date, '日期', { maxLength: 64 }),
        dictionaryMeaning: readOptionalString(input.dictionaryMeaning, '词典释义'),
        focusLastReviewDate: readNullableString(input.focusLastReviewDate, '重点巩固上次首评日期', { maxLength: 64 }),
        focusRecoveryStreak: input.focusRecoveryStreak === undefined ? 0 : readInteger(input.focusRecoveryStreak, '重点巩固恢复连胜', { max: 100000, min: 0 }),
        forgetCount: input.forgetCount === undefined ? 0 : readInteger(input.forgetCount, '忘记次数', { max: 100000, min: 0 }),
        hardCount: input.hardCount === undefined ? 0 : readInteger(input.hardCount, '模糊次数', { max: 100000, min: 0 }),
        isFocusReview: input.isFocusReview === undefined ? false : readBooleanLike(input.isFocusReview, '重点巩固状态'),
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
        sameDayReviewDate: readNullableString(input.sameDayReviewDate, '当天巩固日期', { maxLength: 64 }),
        sameDayReviewDone: input.sameDayReviewDone === undefined ? 0 : readInteger(input.sameDayReviewDone, '当天巩固已完成次数', { max: 100000, min: 0 }),
        sameDayReviewTarget: input.sameDayReviewTarget === undefined ? 0 : readInteger(input.sameDayReviewTarget, '当天巩固目标次数', { max: 100000, min: 0 }),
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
