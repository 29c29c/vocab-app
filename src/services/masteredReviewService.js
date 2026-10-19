import { withTransaction } from '../db/index.js';
import { MASTERED_REVIEW_STAGE, getTodayDateString } from '../client/reviewScheduler.js';
import { findAllUserSettings } from '../repositories/userRepository.js';
import { getSettings } from './settingsService.js';
import { withRecordAccess } from './recordAccess.js';

export async function prepareMasteredReviews(userId, today) {
    return withRecordAccess(async () => {
        const settings = await getSettings(userId);
        if (!settings.masteredReviewEnabled) return { selected: 0 };
        return withTransaction(async transaction => {
            const completed = await transaction.get(
                'SELECT 1 FROM mastered_review_runs WHERE user_id = ? AND review_date = ?',
                [userId, today]
            );
            if (completed) return { selected: 0 };
            // Missing historical mastery dates cannot establish an age. Start
            // recording now rather than guessing from the word's creation date.
            await transaction.run(
                `UPDATE records SET mastered_date = ?, revision = revision + 1, last_mutation_id = NULL
                 WHERE user_id = ? AND mastered = 1
                   AND (mastered_date IS NULL OR TRIM(mastered_date) = '')`,
                [today, userId]
            );

            // The draw date survives grading, cancellation and undo, so refreshes
            // and other devices share one daily quota even after words are done.
            const drawn = await transaction.get(
                'SELECT COUNT(*) AS count FROM records WHERE user_id = ? AND mastered_review_date = ?',
                [userId, today]
            );
            // Persist one run even if there are too few eligible words. Neither
            // restarts nor settings changes can trigger another draw today.
            await transaction.run(
                'INSERT INTO mastered_review_runs (user_id, review_date, selected_count) VALUES (?, ?, ?)',
                [userId, today, drawn.count]
            );
            const remaining = Math.max(0, settings.masteredReviewDailyCount - drawn.count);
            if (remaining === 0) return { selected: 0 };

            const candidates = await transaction.all(
                `SELECT id FROM records WHERE user_id = ? AND mastered = 1
                   AND COALESCE(is_focus_review, 0) = 0 AND is_mastered_review = 0
                   AND date(mastered_date) <= date(?, '-' || ? || ' days')
                   AND (mastered_review_date IS NULL OR mastered_review_date <> ?)
                 ORDER BY RANDOM() LIMIT ?`,
                [userId, today, settings.masteredReviewMinDays, today, remaining]
            );
            if (candidates.length === 0) return { selected: 0 };

            const placeholders = candidates.map(() => '?').join(', ');
            await transaction.run(
                `UPDATE records SET mastered = 0, is_mastered_review = 1,
                     mastered_review_date = ?, next_review_date = ?, review_stage = ?,
                     same_day_review_date = NULL, same_day_review_done = 0, same_day_review_target = 0,
                     is_focus_review = 0, focus_recovery_streak = 0, focus_last_review_date = NULL,
                     revision = revision + 1, last_mutation_id = NULL
                 WHERE user_id = ? AND id IN (${placeholders})`,
                [today, today, MASTERED_REVIEW_STAGE, userId, ...candidates.map(record => record.id)]
            );
            await transaction.run(
                'UPDATE mastered_review_runs SET selected_count = ? WHERE user_id = ? AND review_date = ?',
                [drawn.count + candidates.length, userId, today]
            );
            return { selected: candidates.length };
        });
    });
}

export async function runMasteredReviewDailyBatch(today = getTodayDateString()) {
    const users = await findAllUserSettings();
    const errors = [];
    let selected = 0;
    for (const user of users) {
        let enabled;
        try {
            enabled = JSON.parse(user.settings || '{}').masteredReviewEnabled === true;
        } catch {
            continue;
        }
        if (!enabled) continue;
        try {
            selected += (await prepareMasteredReviews(user.id, today)).selected;
        } catch (error) {
            errors.push(new Error(`用户 ${user.id} 的回归复习抽取失败`, { cause: error }));
        }
    }
    if (errors.length) throw new AggregateError(errors, '每日回归复习任务未全部完成');
    return { selected };
}
