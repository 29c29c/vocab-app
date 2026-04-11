import {
    pickAllowedKeys,
    readBooleanLike,
    readInteger,
    readNullableString,
    readOptionalString,
    readPositiveIntegerParam,
    readRequiredString
} from './helpers.js';

export function validateCreateRecordPayload(body) {
    const input = pickAllowedKeys(body, [
        'aiAnalysis',
        'customMeaning',
        'date',
        'reading',
        'sentence',
        'word'
    ]);

    return {
        aiAnalysis: readOptionalString(input.aiAnalysis, 'AI 分析'),
        customMeaning: readOptionalString(input.customMeaning, '自定义释义'),
        date: readRequiredString(input.date, '日期', { maxLength: 64 }),
        reading: readOptionalString(input.reading, '音标'),
        sentence: readOptionalString(input.sentence, '例句'),
        word: readRequiredString(input.word, '单词', { maxLength: 255 })
    };
}

export function validateUpdateRecordPayload(body) {
    const input = pickAllowedKeys(body, [
        'aiAnalysis',
        'customMeaning',
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
        'sameDayReviewTarget'
    ]);

    return {
        aiAnalysis: readOptionalString(input.aiAnalysis, 'AI 分析'),
        customMeaning: readOptionalString(input.customMeaning, '自定义释义'),
        focusLastReviewDate: readNullableString(input.focusLastReviewDate, '重点巩固上次首评日期', { maxLength: 64 }),
        focusRecoveryStreak: readInteger(input.focusRecoveryStreak, '重点巩固恢复连胜', { max: 100000, min: 0 }),
        forgetCount: readInteger(input.forgetCount, '忘记次数', { max: 100000, min: 0 }),
        hardCount: readInteger(input.hardCount, '模糊次数', { max: 100000, min: 0 }),
        isFocusReview: readBooleanLike(input.isFocusReview, '重点巩固状态'),
        mastered: readBooleanLike(input.mastered, '掌握状态'),
        masteredDate: readNullableString(input.masteredDate, '掌握日期', { maxLength: 64 }),
        needsReadingPractice: readBooleanLike(input.needsReadingPractice, '朗读练习标记'),
        nextReviewDate: readRequiredString(input.nextReviewDate, '下次复习日期', { maxLength: 64 }),
        reading: readOptionalString(input.reading, '音标'),
        reviewStage: readInteger(input.reviewStage, '复习阶段', { max: 100000, min: 0 }),
        sameDayReviewDate: readNullableString(input.sameDayReviewDate, '当天巩固日期', { maxLength: 64 }),
        sameDayReviewDone: readInteger(input.sameDayReviewDone, '当天巩固已完成次数', { max: 100000, min: 0 }),
        sameDayReviewTarget: readInteger(input.sameDayReviewTarget, '当天巩固目标次数', { max: 100000, min: 0 })
    };
}

export function validateRecordIdParams(params) {
    return {
        id: readPositiveIntegerParam(params.id, '记录 ID')
    };
}
