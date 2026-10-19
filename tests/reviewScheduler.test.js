import test from 'node:test';
import assert from 'node:assert/strict';
import {
    EMPTY_FOCUS_REVIEW,
    EMPTY_SAME_DAY_REVIEW,
    getTodayDateString,
    normalizeReviewRecord,
    restoreReviewProgress,
    scheduleReviewResult
} from '../src/client/reviewScheduler.js';

const TODAY = '2026-10-19';

function vocabulary(overrides = {}) {
    return {
        id: 1,
        word: 'remember',
        reviewStage: 7,
        nextReviewDate: TODAY,
        needsReadingPractice: true,
        mastered: false,
        masteredDate: null,
        isMasteredReview: false,
        masteredReviewDate: null,
        forgetCount: 0,
        hardCount: 0,
        ...EMPTY_FOCUS_REVIEW,
        ...EMPTY_SAME_DAY_REVIEW,
        ...overrides
    };
}

function grade(record, quality, today = TODAY) {
    return scheduleReviewResult(record, quality, today).record;
}

function finishPenalty(record, target, today = TODAY) {
    const stage = record.reviewStage;
    assert.equal(record.sameDayReviewTarget, target);
    for (let i = 1; i <= target; i++) {
        const result = scheduleReviewResult(record, 'easy', today);
        record = result.record;
        assert.equal(result.shouldRequeue, i < target);
        assert.equal(record.reviewStage, stage);
        assert.equal(record.focusRecoveryStreak, 0);
        assert.equal(record.isFocusReview, true);
        assert.equal(record.mastered, false);
        if (i < target) assert.equal(record.nextReviewDate, today);
    }
    assert.equal(record.sameDayReviewTarget, 0);
    return record;
}

for (const [quality, counter, threshold, target] of [
    ['hard', 'hardCount', 5, 2],
    ['forget', 'forgetCount', 3, 3]
]) {
    test(`${quality}: entering focus records the failed first rating and requires two later first-rating successes`, () => {
        const original = vocabulary({ [counter]: threshold - 1 });
        const entered = scheduleReviewResult(original, quality, TODAY);
        assert.equal(entered.shouldRequeue, true);
        assert.equal(entered.record[counter], threshold);
        assert.equal(entered.record.isFocusReview, true);
        assert.equal(entered.record.reviewStage, 7);
        assert.equal(entered.record.focusLastReviewDate, TODAY);
        assert.equal(entered.record.focusRecoveryStreak, 0);

        const completed = finishPenalty(entered.record, target);
        assert.equal(completed.nextReviewDate, '2026-10-20');

        const first = grade(completed, 'easy', '2026-10-20');
        assert.equal(first.isFocusReview, true);
        assert.equal(first.focusRecoveryStreak, 1);
        assert.equal(first.nextReviewDate, '2026-10-23');
        assert.equal(first.reviewStage, 7);

        // Repeating a same-day rating cannot substitute for the second first rating.
        const repeated = grade(first, 'easy', '2026-10-20');
        assert.equal(repeated.focusRecoveryStreak, 1);
        assert.equal(repeated.isFocusReview, true);

        const recovered = grade(repeated, 'easy', '2026-10-23');
        assert.equal(recovered.isFocusReview, false);
        assert.equal(recovered.reviewStage, 7);
        assert.equal(recovered.mastered, false);
        assert.equal(recovered.nextReviewDate, '2026-10-27');

        // Historical failure totals remain available without re-entering on an easy rating.
        const normal = grade(recovered, 'easy', '2026-10-27');
        assert.equal(normal.isFocusReview, false);
        assert.equal(normal.reviewStage, 8);
        assert.equal(normal[counter], threshold);
        assert.equal(original.isFocusReview, false);
        assert.equal(original[counter], threshold - 1);
    });

    test(`${quality}: a failed review at 1/2 resets recovery and keeps the stage throughout the penalty`, () => {
        const focused = vocabulary({
            isFocusReview: true,
            focusRecoveryStreak: 1,
            focusLastReviewDate: '2026-10-16'
        });
        const failed = grade(focused, quality);
        assert.equal(failed.reviewStage, 7);
        assert.equal(failed.focusRecoveryStreak, 0);
        const completed = finishPenalty(failed, target);
        assert.equal(completed.nextReviewDate, '2026-10-20');
        const first = grade(completed, 'easy', '2026-10-20');
        assert.equal(first.focusRecoveryStreak, 1);
        assert.equal(first.isFocusReview, true);
        assert.equal(first.nextReviewDate, '2026-10-23');
    });

    test(`${quality}: undoing the daily failure lets the replacement rating count as the first`, () => {
        const snapshot = vocabulary({ isFocusReview: true });
        const failed = grade(snapshot, quality);
        const restored = restoreReviewProgress({ ...failed, word: 'edited', revision: 4 }, snapshot);
        assert.equal(restored.word, 'edited');
        assert.equal(restored.revision, 4);
        assert.equal(restored.focusLastReviewDate, null);
        assert.equal(restored.sameDayReviewTarget, 0);
        assert.equal(restored[counter], 0);
        const first = grade(restored, 'easy');
        assert.equal(first.focusRecoveryStreak, 1);
        assert.equal(first.nextReviewDate, '2026-10-22');
        assert.equal(first.reviewStage, 7);
    });
}

for (const [needsReadingPractice, stage] of [[false, 0], [false, 7], [true, 7], [true, 12]]) {
    test(`focus keeps stage ${stage} in ${needsReadingPractice ? 'reading' : 'standard'} mode without graduating`, () => {
        const original = vocabulary({ isFocusReview: true, needsReadingPractice, reviewStage: stage });
        const first = grade(original, 'easy');
        assert.equal(first.reviewStage, stage);
        assert.equal(first.nextReviewDate, '2026-10-22');
        assert.equal(first.mastered, false);
        assert.equal(first.isFocusReview, true);
        const recovered = grade(first, 'easy', '2026-10-22');
        assert.equal(recovered.reviewStage, stage);
        assert.equal(recovered.mastered, false);
        assert.equal(recovered.isFocusReview, false);
        assert.equal(recovered.focusRecoveryStreak, 0);
        assert.equal(recovered.focusLastReviewDate, null);
        if (stage === 7 && !needsReadingPractice || stage === 12) {
            assert.equal(recovered.nextReviewDate, '2026-10-23');
            assert.equal(grade(recovered, 'easy', '2026-10-23').mastered, true);
        }
    });
}

test('undo restores both recovery successes and the exit from focus', () => {
    const original = vocabulary({ isFocusReview: true, hardCount: 5 });
    const first = grade(original, 'easy');
    assert.deepEqual(restoreReviewProgress(first, original), original);
    const recovered = grade(first, 'easy', '2026-10-22');
    assert.deepEqual(restoreReviewProgress(recovered, first), first);
    const failed = grade(restoreReviewProgress(recovered, first), 'hard', '2026-10-22');
    assert.equal(failed.focusRecoveryStreak, 0);
    assert.equal(failed.isFocusReview, true);
    assert.equal(failed.reviewStage, 7);
});

test('undoing entry restores ordinary review and its previous failure count', () => {
    const original = vocabulary({ forgetCount: 2 });
    const entered = grade(original, 'forget');
    assert.equal(entered.isFocusReview, true);
    assert.deepEqual(restoreReviewProgress(entered, original), original);
});

test('another failed rating restarts the same-day penalty without changing the stage', () => {
    const original = vocabulary({ isFocusReview: true });
    const partial = grade(grade(original, 'hard'), 'easy');
    assert.equal(partial.sameDayReviewDone, 1);
    const failed = grade(partial, 'forget');
    assert.equal(failed.sameDayReviewDone, 0);
    assert.equal(failed.reviewStage, 7);
    assert.equal(finishPenalty(failed, 3).nextReviewDate, '2026-10-20');
});

test('a legacy penalty with no first-review marker cannot count its repetitions as recovery', () => {
    const legacy = vocabulary({
        isFocusReview: true,
        focusRecoveryStreak: 1,
        sameDayReviewDate: TODAY,
        sameDayReviewTarget: 2
    });
    const completed = finishPenalty(legacy, 2);
    assert.equal(completed.nextReviewDate, '2026-10-20');
    assert.equal(completed.focusRecoveryStreak, 0);
});

test('recovery survives reload and overdue reviews still count as successive first reviews', () => {
    const first = grade(vocabulary({ isFocusReview: true }), 'easy');
    const reloaded = normalizeReviewRecord(JSON.parse(JSON.stringify(first)), '2026-10-25');
    assert.equal(reloaded.focusRecoveryStreak, 1);
    const recovered = grade(reloaded, 'easy', '2026-10-25');
    assert.equal(recovered.isFocusReview, false);
    assert.equal(recovered.reviewStage, 7);
});

test('ordinary review still advances, resets on forget, preserves on hard, and graduates at the end', () => {
    const normal = vocabulary({ reviewStage: 4, needsReadingPractice: false });
    const easy = grade(normal, 'easy');
    assert.equal(easy.reviewStage, 5);
    assert.equal(easy.nextReviewDate, '2026-11-03');
    assert.equal(grade(normal, 'forget').reviewStage, 0);
    assert.equal(grade(normal, 'hard').reviewStage, 4);
    const mastered = grade(vocabulary({ needsReadingPractice: false }), 'easy');
    assert.equal(mastered.mastered, true);
    assert.equal(mastered.masteredDate, TODAY);
});

test('historical totals only trigger focus on a new failed rating', () => {
    const recovered = vocabulary({ hardCount: 5, forgetCount: 3 });
    assert.equal(grade(recovered, 'easy').isFocusReview, false);
    for (const quality of ['hard', 'forget']) {
        const failed = grade(recovered, quality);
        assert.equal(failed.isFocusReview, true);
        assert.equal(failed.focusRecoveryStreak, 0);
        assert.equal(failed.reviewStage, 7);
    }
});

test('review days reset at Beijing 04:00 and fixed intervals work across year boundaries', () => {
    assert.equal(getTodayDateString(new Date('2026-10-19T19:59:59Z')), '2026-10-19');
    assert.equal(getTodayDateString(new Date('2026-10-19T20:00:00Z')), '2026-10-20');
    const focused = vocabulary({ isFocusReview: true });
    assert.equal(grade(focused, 'easy', '2026-12-30').nextReviewDate, '2027-01-02');
    const failed = grade(focused, 'forget', '2026-12-31');
    assert.equal(finishPenalty(failed, 3, '2026-12-31').nextReviewDate, '2027-01-01');
});

test('a recalled word immediately returns to mastery on its first easy rating', () => {
    const recalled = vocabulary({
        isMasteredReview: true, masteredReviewDate: TODAY, masteredDate: '2026-08-01',
        forgetCount: 9, hardCount: 9, needsReadingPractice: true
    });
    const result = scheduleReviewResult(recalled, 'easy', TODAY);
    assert.equal(result.shouldRequeue, false);
    assert.equal(result.record.mastered, true);
    assert.equal(result.record.masteredDate, TODAY);
    assert.equal(result.record.isMasteredReview, false);
    assert.equal(result.record.isFocusReview, false);
    assert.equal(result.record.masteredReviewDate, TODAY);
    assert.deepEqual(restoreReviewProgress(result.record, recalled), recalled);
});

for (const [quality, target, stage] of [['hard', 2, 7], ['forget', 3, 0]]) {
    test(`a recalled word's first ${quality} removes the label and uses ordinary stage-seven rules`, () => {
        const recalled = vocabulary({ isMasteredReview: true, masteredDate: '2026-08-01', needsReadingPractice: false });
        const failed = scheduleReviewResult(recalled, quality, TODAY);
        assert.equal(failed.shouldRequeue, true);
        assert.equal(failed.record.isMasteredReview, false);
        assert.equal(failed.record.mastered, false);
        assert.equal(failed.record.masteredDate, null);
        assert.equal(failed.record.reviewStage, stage);
        assert.equal(failed.record.sameDayReviewTarget, target);
        let record = failed.record;
        for (let i = 0; i < target; i++) record = grade(record, 'easy');
        assert.equal(record.isMasteredReview, false);
        assert.equal(record.mastered, false);
        assert.equal(record.nextReviewDate, '2026-10-20');
        assert.deepEqual(restoreReviewProgress(failed.record, recalled), recalled);
    });

    test(`a recalled word's first ${quality} can enter focus and needs two later daily first successes`, () => {
        const recalled = vocabulary({ isMasteredReview: true, forgetCount: 2, hardCount: 4 });
        const failed = grade(recalled, quality);
        assert.equal(failed.isMasteredReview, false);
        assert.equal(failed.reviewStage, 7);
        const completed = finishPenalty(failed, target);
        const first = grade(completed, 'easy', '2026-10-20');
        assert.equal(first.focusRecoveryStreak, 1);
        assert.equal(first.isFocusReview, true);
        const recovered = grade(first, 'easy', '2026-10-23');
        assert.equal(recovered.reviewStage, 7);
        assert.equal(recovered.isMasteredReview, false);
        assert.equal(recovered.isFocusReview, false);
    });
}
