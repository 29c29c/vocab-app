export function mapRecordRowToApiRecord(row) {
    return {
        aiAnalysis: row.ai_analysis,
        aiImage: row.ai_image,
        customMeaning: row.custom_meaning,
        date: row.date,
        id: row.id,
        mastered: Boolean(row.mastered),
        masteredDate: row.mastered_date,
        needsReadingPractice: Boolean(row.needs_reading_practice),
        nextReviewDate: row.next_review_date,
        reading: row.reading,
        reviewStage: row.review_stage,
        sentence: row.sentence,
        word: row.word
    };
}

export function mapCreatePayloadToDbRecord(userId, payload) {
    return {
        aiAnalysis: payload.aiAnalysis || '',
        aiImage: '',
        customMeaning: payload.customMeaning || '',
        date: payload.date,
        mastered: 0,
        masteredDate: null,
        needsReadingPractice: 0,
        nextReviewDate: payload.date,
        reading: payload.reading || '',
        reviewStage: 0,
        sentence: payload.sentence || '',
        userId,
        word: payload.word
    };
}

export function mapInsertedRecordToApiRecord(id, dbRecord) {
    return {
        aiAnalysis: dbRecord.aiAnalysis,
        customMeaning: dbRecord.customMeaning,
        date: dbRecord.date,
        id,
        mastered: false,
        needsReadingPractice: false,
        nextReviewDate: dbRecord.nextReviewDate,
        reading: dbRecord.reading,
        reviewStage: dbRecord.reviewStage,
        sentence: dbRecord.sentence,
        word: dbRecord.word
    };
}

export function mapUpdatePayloadToDbRecord(payload) {
    return {
        aiAnalysis: payload.aiAnalysis || '',
        customMeaning: payload.customMeaning || '',
        mastered: payload.mastered ? 1 : 0,
        masteredDate: payload.masteredDate ?? null,
        needsReadingPractice: payload.needsReadingPractice ? 1 : 0,
        nextReviewDate: payload.nextReviewDate,
        reading: payload.reading || '',
        reviewStage: payload.reviewStage
    };
}

export function mapLegacyPayloadToDbRecord(userId, payload) {
    return {
        aiAnalysis: payload.aiAnalysis || '',
        aiImage: payload.aiImage || '',
        customMeaning: payload.customMeaning || '',
        date: payload.date ?? null,
        mastered: payload.mastered ? 1 : 0,
        masteredDate: payload.masteredDate ?? null,
        needsReadingPractice: payload.needsReadingPractice ? 1 : 0,
        nextReviewDate: payload.nextReviewDate ?? payload.date ?? null,
        reading: payload.reading || '',
        reviewStage: Number.isInteger(payload.reviewStage) ? payload.reviewStage : 0,
        sentence: payload.sentence || '',
        userId,
        word: payload.word ?? null
    };
}
