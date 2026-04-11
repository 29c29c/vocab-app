export function mapRecordRowToApiRecord(row) {
    return {
        aiAnalysis: row.ai_analysis,
        aiImage: row.ai_image,
        createdAt: row.created_at,
        creationSource: row.creation_source || 'manual',
        customMeaning: row.custom_meaning,
        date: row.date,
        dictionaryMeaning: row.dictionary_meaning || '',
        focusLastReviewDate: row.focus_last_review_date,
        focusRecoveryStreak: row.focus_recovery_streak,
        forgetCount: row.forget_count,
        hardCount: row.hard_count,
        id: row.id,
        isFocusReview: Boolean(row.is_focus_review),
        mastered: Boolean(row.mastered),
        masteredDate: row.mastered_date,
        needsReadingPractice: Boolean(row.needs_reading_practice),
        nextReviewDate: row.next_review_date,
        reading: row.reading,
        reviewStage: row.review_stage,
        sameDayReviewDate: row.same_day_review_date,
        sameDayReviewDone: row.same_day_review_done,
        sameDayReviewTarget: row.same_day_review_target,
        sentence: row.sentence,
        word: row.word
    };
}

export function mapCreatePayloadToDbRecord(userId, payload) {
    const createdAt = new Date().toISOString();

    return {
        aiAnalysis: payload.aiAnalysis || '',
        aiImage: '',
        createdAt,
        creationSource: payload.creationSource || 'manual',
        customMeaning: payload.customMeaning || '',
        date: payload.date,
        dictionaryMeaning: payload.dictionaryMeaning || '',
        focusLastReviewDate: null,
        focusRecoveryStreak: 0,
        forgetCount: 0,
        hardCount: 0,
        isFocusReview: 0,
        mastered: 0,
        masteredDate: null,
        needsReadingPractice: 0,
        nextReviewDate: payload.date,
        reading: payload.reading || '',
        reviewStage: 0,
        sameDayReviewDate: null,
        sameDayReviewDone: 0,
        sameDayReviewTarget: 0,
        sentence: payload.sentence || '',
        userId,
        word: payload.word
    };
}

export function mapInsertedRecordToApiRecord(id, dbRecord) {
    return {
        aiAnalysis: dbRecord.aiAnalysis,
        createdAt: dbRecord.createdAt,
        creationSource: dbRecord.creationSource,
        customMeaning: dbRecord.customMeaning,
        date: dbRecord.date,
        dictionaryMeaning: dbRecord.dictionaryMeaning,
        focusLastReviewDate: dbRecord.focusLastReviewDate,
        focusRecoveryStreak: dbRecord.focusRecoveryStreak,
        forgetCount: dbRecord.forgetCount,
        hardCount: dbRecord.hardCount,
        id,
        isFocusReview: Boolean(dbRecord.isFocusReview),
        mastered: false,
        needsReadingPractice: false,
        nextReviewDate: dbRecord.nextReviewDate,
        reading: dbRecord.reading,
        reviewStage: dbRecord.reviewStage,
        sameDayReviewDate: dbRecord.sameDayReviewDate,
        sameDayReviewDone: dbRecord.sameDayReviewDone,
        sameDayReviewTarget: dbRecord.sameDayReviewTarget,
        sentence: dbRecord.sentence,
        word: dbRecord.word
    };
}

export function mapUpdatePayloadToDbRecord(payload) {
    return {
        aiAnalysis: payload.aiAnalysis || '',
        customMeaning: payload.customMeaning || '',
        dictionaryMeaning: payload.dictionaryMeaning || '',
        focusLastReviewDate: payload.focusLastReviewDate ?? null,
        focusRecoveryStreak: payload.focusRecoveryStreak ?? 0,
        forgetCount: payload.forgetCount ?? 0,
        hardCount: payload.hardCount ?? 0,
        isFocusReview: payload.isFocusReview ? 1 : 0,
        mastered: payload.mastered ? 1 : 0,
        masteredDate: payload.masteredDate ?? null,
        needsReadingPractice: payload.needsReadingPractice ? 1 : 0,
        nextReviewDate: payload.nextReviewDate,
        reading: payload.reading || '',
        reviewStage: payload.reviewStage,
        sameDayReviewDate: payload.sameDayReviewDate ?? null,
        sameDayReviewDone: payload.sameDayReviewDone ?? 0,
        sameDayReviewTarget: payload.sameDayReviewTarget ?? 0
    };
}

export function mapLegacyPayloadToDbRecord(userId, payload) {
    return {
        aiAnalysis: payload.aiAnalysis || '',
        aiImage: payload.aiImage || '',
        createdAt: payload.createdAt ?? payload.date ?? new Date().toISOString(),
        creationSource: payload.creationSource || 'manual',
        customMeaning: payload.customMeaning || '',
        date: payload.date ?? null,
        dictionaryMeaning: payload.dictionaryMeaning || '',
        focusLastReviewDate: payload.focusLastReviewDate ?? null,
        focusRecoveryStreak: Number.isInteger(payload.focusRecoveryStreak) ? payload.focusRecoveryStreak : 0,
        forgetCount: Number.isInteger(payload.forgetCount) ? payload.forgetCount : 0,
        hardCount: Number.isInteger(payload.hardCount) ? payload.hardCount : 0,
        isFocusReview: payload.isFocusReview ? 1 : 0,
        mastered: payload.mastered ? 1 : 0,
        masteredDate: payload.masteredDate ?? null,
        needsReadingPractice: payload.needsReadingPractice ? 1 : 0,
        nextReviewDate: payload.nextReviewDate ?? payload.date ?? null,
        reading: payload.reading || '',
        reviewStage: Number.isInteger(payload.reviewStage) ? payload.reviewStage : 0,
        sameDayReviewDate: payload.sameDayReviewDate ?? null,
        sameDayReviewDone: Number.isInteger(payload.sameDayReviewDone) ? payload.sameDayReviewDone : 0,
        sameDayReviewTarget: Number.isInteger(payload.sameDayReviewTarget) ? payload.sameDayReviewTarget : 0,
        sentence: payload.sentence || '',
        userId,
        word: payload.word ?? null
    };
}
