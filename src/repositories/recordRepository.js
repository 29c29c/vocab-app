import {
    all,
    finalizeStatement,
    prepare,
    run,
    runStatement,
    withTransaction
} from '../db/index.js';

export async function findRecordsByUserId(userId) {
    return all('SELECT * FROM records WHERE user_id = ? ORDER BY id ASC', [userId]);
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

export async function updateRecordById({ id, userId, record }) {
    return run(
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
            needs_reading_practice = ?
         WHERE id = ? AND user_id = ?`,
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
            id,
            userId
        ]
    );
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
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
