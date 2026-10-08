import {
    all,
    finalizeStatement,
    get,
    prepare,
    run,
    runStatement,
    withTransaction
} from '../db/index.js';

export async function findRecordsByUserId(userId) {
    return all('SELECT * FROM records WHERE user_id = ? ORDER BY id ASC', [userId]);
}

export async function findReviewBootstrapByUserId(userId, today) {
    const [countRow, rows] = await Promise.all([
        get('SELECT COUNT(*) AS count FROM records WHERE user_id = ?', [userId]),
        all(
            `SELECT * FROM records
             WHERE user_id = ? AND COALESCE(mastered, 0) = 0
               AND (is_focus_review = 1 OR next_review_date IS NULL OR next_review_date <= ?)
             ORDER BY id ASC`,
            [userId, today]
        )
    ]);
    return { count: countRow.count, rows };
}

export async function insertRecord(record) {
    return run(
        `INSERT INTO records (
            user_id,
            date,
            word,
            sentence,
            custom_meaning,
            dictionary_meaning,
            creation_source,
            ai_analysis,
            ai_image,
            reading,
            review_stage,
            next_review_date,
            same_day_review_date,
            same_day_review_target,
            same_day_review_done,
            forget_count,
            hard_count,
            is_focus_review,
            focus_recovery_streak,
            focus_last_review_date,
            mastered,
            mastered_date,
            needs_reading_practice,
            created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            record.userId,
            record.date,
            record.word,
            record.sentence,
            record.customMeaning,
            record.dictionaryMeaning,
            record.creationSource,
            record.aiAnalysis,
            record.aiImage,
            record.reading,
            record.reviewStage,
            record.nextReviewDate,
            record.sameDayReviewDate,
            record.sameDayReviewTarget,
            record.sameDayReviewDone,
            record.forgetCount,
            record.hardCount,
            record.isFocusReview,
            record.focusRecoveryStreak,
            record.focusLastReviewDate,
            record.mastered,
            record.masteredDate,
            record.needsReadingPractice,
            record.createdAt
        ]
    );
}

export async function updateRecordById({ id, userId, record, revision, mutationId }) {
    const existing = await get(
        'SELECT revision, last_mutation_id FROM records WHERE id = ? AND user_id = ?',
        [id, userId]
    );
    if (existing?.last_mutation_id === mutationId) {
        return { changes: 1, revision: existing.revision };
    }

    const result = await run(
        `UPDATE records SET
            review_stage = ?,
            next_review_date = ?,
            same_day_review_date = ?,
            same_day_review_target = ?,
            same_day_review_done = ?,
            forget_count = ?,
            hard_count = ?,
            is_focus_review = ?,
            focus_recovery_streak = ?,
            focus_last_review_date = ?,
            mastered = ?,
            mastered_date = ?,
            custom_meaning = ?,
            dictionary_meaning = ?,
            ai_analysis = ?,
            reading = ?,
            needs_reading_practice = ?,
            revision = revision + 1,
            last_mutation_id = ?
         WHERE id = ? AND user_id = ? AND revision = ?`,
        [
            record.reviewStage,
            record.nextReviewDate,
            record.sameDayReviewDate,
            record.sameDayReviewTarget,
            record.sameDayReviewDone,
            record.forgetCount,
            record.hardCount,
            record.isFocusReview,
            record.focusRecoveryStreak,
            record.focusLastReviewDate,
            record.mastered,
            record.masteredDate,
            record.customMeaning,
            record.dictionaryMeaning,
            record.aiAnalysis,
            record.reading,
            record.needsReadingPractice,
            mutationId,
            id,
            userId,
            revision
        ]
    );
    if (result.changes > 0) {
        return { changes: 1, revision: revision + 1 };
    }

    // A retry may arrive after the first attempt committed but before its response arrived.
    const latest = await get(
        'SELECT revision, last_mutation_id FROM records WHERE id = ? AND user_id = ?',
        [id, userId]
    );
    return latest?.last_mutation_id === mutationId
        ? { changes: 1, revision: latest.revision }
        : { changes: 0, conflict: Boolean(latest), revision: latest?.revision };
}

export async function deleteRecordById({ id, userId }) {
    return run('DELETE FROM records WHERE id = ? AND user_id = ?', [id, userId]);
}

export async function replaceUserRecords(userId, records) {
    return withTransaction(async () => {
        await run('DELETE FROM records WHERE user_id = ?', [userId]);

        const statement = prepare(
            `INSERT INTO records (
                user_id,
                date,
                word,
                sentence,
                custom_meaning,
                dictionary_meaning,
                creation_source,
                ai_analysis,
                ai_image,
                reading,
                review_stage,
                next_review_date,
                same_day_review_date,
                same_day_review_target,
                same_day_review_done,
                forget_count,
                hard_count,
                is_focus_review,
                focus_recovery_streak,
                focus_last_review_date,
                mastered,
                mastered_date,
                needs_reading_practice,
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );

        try {
            for (const record of records) {
                await runStatement(statement, [
                    record.userId,
                    record.date,
                    record.word,
                    record.sentence,
                    record.customMeaning,
                    record.dictionaryMeaning,
                    record.creationSource,
                    record.aiAnalysis,
                    record.aiImage,
                    record.reading,
                    record.reviewStage,
                    record.nextReviewDate,
                    record.sameDayReviewDate,
                    record.sameDayReviewTarget,
                    record.sameDayReviewDone,
                    record.forgetCount,
                    record.hardCount,
                    record.isFocusReview,
                    record.focusRecoveryStreak,
                    record.focusLastReviewDate,
                    record.mastered,
                    record.masteredDate,
                    record.needsReadingPractice,
                    record.createdAt
                ]);
            }
        } finally {
            await finalizeStatement(statement);
        }
    });
}
