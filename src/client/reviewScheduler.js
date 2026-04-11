export const FORGET_SAME_DAY_TARGET = 3;
export const HARD_SAME_DAY_TARGET = 2;
export const FOCUS_FORGET_THRESHOLD = 3;
export const FOCUS_HARD_THRESHOLD = 5;
export const FOCUS_RECOVERY_STREAK_TARGET = 2;

export const EMPTY_SAME_DAY_REVIEW = {
    sameDayReviewDate: null,
    sameDayReviewDone: 0,
    sameDayReviewTarget: 0
};

export const EMPTY_FOCUS_REVIEW = {
    focusLastReviewDate: null,
    focusRecoveryStreak: 0,
    isFocusReview: false
};

export function getTodayDateString() {
    return new Date().toISOString().split('T')[0];
}

export function getFutureDateString(days) {
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + days);
    return nextDate.toISOString().split('T')[0];
}

export function clearSameDayReviewFields(record) {
    return {
        ...record,
        ...EMPTY_SAME_DAY_REVIEW
    };
}

export function clearFocusReviewFields(record) {
    return {
        ...record,
        ...EMPTY_FOCUS_REVIEW
    };
}

export function normalizeReviewRecord(record, today = getTodayDateString()) {
    const normalized = {
        ...record,
        customMeaning: record.customMeaning || '',
        focusLastReviewDate: record.focusLastReviewDate ?? null,
        focusRecoveryStreak: Number.isInteger(record.focusRecoveryStreak) ? record.focusRecoveryStreak : 0,
        forgetCount: Number.isInteger(record.forgetCount) ? record.forgetCount : 0,
        hardCount: Number.isInteger(record.hardCount) ? record.hardCount : 0,
        isFocusReview: Boolean(record.isFocusReview),
        mastered: Boolean(record.mastered),
        masteredDate: record.masteredDate || null,
        needsReadingPractice: Boolean(record.needsReadingPractice),
        nextReviewDate: record.nextReviewDate || today,
        reading: record.reading || '',
        reviewStage: record.reviewStage ?? 0,
        sameDayReviewDate: record.sameDayReviewDate ?? null,
        sameDayReviewDone: Number.isInteger(record.sameDayReviewDone) ? record.sameDayReviewDone : 0,
        sameDayReviewTarget: Number.isInteger(record.sameDayReviewTarget) ? record.sameDayReviewTarget : 0
    };

    if (normalized.sameDayReviewTarget > 0 && normalized.sameDayReviewDate !== today) {
        return clearSameDayReviewFields(normalized);
    }

    if (normalized.sameDayReviewDone > normalized.sameDayReviewTarget) {
        return {
            ...normalized,
            sameDayReviewDone: normalized.sameDayReviewTarget
        };
    }

    return normalized;
}

export function getFocusSeverityScore(record) {
    return (record.forgetCount ?? 0) * 2 + (record.hardCount ?? 0);
}

export function sortFocusRecords(records) {
    return [...records].sort((left, right) => {
        const leftDate = left.nextReviewDate || '';
        const rightDate = right.nextReviewDate || '';
        if (leftDate !== rightDate) {
            return leftDate.localeCompare(rightDate);
        }

        const severityDiff = getFocusSeverityScore(right) - getFocusSeverityScore(left);
        if (severityDiff !== 0) {
            return severityDiff;
        }

        return left.id - right.id;
    });
}

export function isSameDayReviewActive(record, today = getTodayDateString()) {
    return record?.sameDayReviewDate === today && (record?.sameDayReviewTarget ?? 0) > 0;
}

export function startSameDayReview(record, quality, today = getTodayDateString()) {
    return {
        ...record,
        nextReviewDate: today,
        reviewStage: quality === 'forget' ? 0 : record.reviewStage,
        sameDayReviewDate: today,
        sameDayReviewDone: 0,
        sameDayReviewTarget: quality === 'forget' ? FORGET_SAME_DAY_TARGET : HARD_SAME_DAY_TARGET
    };
}

export function progressSameDayReview(record, today = getTodayDateString()) {
    const nextDone = Math.min(record.sameDayReviewTarget, (record.sameDayReviewDone ?? 0) + 1);
    const updatedRecord = {
        ...record,
        nextReviewDate: today,
        sameDayReviewDone: nextDone
    };

    if (nextDone < record.sameDayReviewTarget) {
        return { completed: false, record: updatedRecord };
    }

    return {
        completed: true,
        record: {
            ...clearSameDayReviewFields(updatedRecord),
            nextReviewDate: getFutureDateString(1)
        }
    };
}

export function applyReviewPerformance(record, quality, today = getTodayDateString()) {
    const updatedRecord = {
        ...record,
        forgetCount: record.forgetCount ?? 0,
        hardCount: record.hardCount ?? 0,
        focusRecoveryStreak: record.focusRecoveryStreak ?? 0,
        focusLastReviewDate: record.focusLastReviewDate ?? null,
        isFocusReview: record.isFocusReview ?? false
    };

    if (quality === 'forget') {
        updatedRecord.forgetCount += 1;
    } else if (quality === 'hard') {
        updatedRecord.hardCount += 1;
    }

    if (updatedRecord.isFocusReview && updatedRecord.focusLastReviewDate !== today) {
        updatedRecord.focusRecoveryStreak = quality === 'easy'
            ? updatedRecord.focusRecoveryStreak + 1
            : 0;
        updatedRecord.focusLastReviewDate = today;
    }

    if (
        !updatedRecord.isFocusReview &&
        (
            updatedRecord.forgetCount >= FOCUS_FORGET_THRESHOLD ||
            updatedRecord.hardCount >= FOCUS_HARD_THRESHOLD
        )
    ) {
        updatedRecord.isFocusReview = true;
        updatedRecord.focusRecoveryStreak = 0;
        updatedRecord.focusLastReviewDate = null;
    }

    return updatedRecord;
}

export function maybeExitFocusReview(record) {
    if (!record.isFocusReview || record.focusRecoveryStreak < FOCUS_RECOVERY_STREAK_TARGET) {
        return record;
    }

    return clearFocusReviewFields(record);
}

export function getRandomRequeueIndex(restLength) {
    if (restLength <= 0) return 0;

    let minIndex;
    let maxIndex;

    if (restLength >= 8) {
        minIndex = 4;
        maxIndex = 8;
    } else if (restLength >= 4) {
        minIndex = Math.max(2, Math.ceil(restLength / 2));
        maxIndex = restLength;
    } else {
        minIndex = restLength === 1 ? 1 : Math.max(1, restLength - 1);
        maxIndex = restLength;
    }

    minIndex = Math.min(minIndex, restLength);
    maxIndex = Math.min(maxIndex, restLength);

    return minIndex + Math.floor(Math.random() * (maxIndex - minIndex + 1));
}

export function reinsertReviewItem(queue, record) {
    const rest = queue.slice(1).filter(item => item.id !== record.id);
    const insertIndex = getRandomRequeueIndex(rest.length);
    const nextQueue = [...rest];
    nextQueue.splice(insertIndex, 0, record);
    return nextQueue;
}

export function reconcileReviewQueue(previousQueue, candidates, { shuffleOnInit = false } = {}) {
    if (!Array.isArray(candidates) || candidates.length === 0) {
        return [];
    }

    if (!Array.isArray(previousQueue) || previousQueue.length === 0) {
        return shuffleOnInit ? reinsertInitialQueue(candidates) : [...candidates];
    }

    const candidateMap = new Map(candidates.map(candidate => [candidate.id, candidate]));
    const nextQueue = previousQueue
        .map(item => candidateMap.get(item.id))
        .filter(Boolean);
    const existingIds = new Set(nextQueue.map(item => item.id));
    const missingItems = candidates.filter(candidate => !existingIds.has(candidate.id));

    if (shuffleOnInit && missingItems.length > 0) {
        nextQueue.push(...reinsertInitialQueue(missingItems));
    } else {
        nextQueue.push(...missingItems);
    }

    return nextQueue;
}

function reinsertInitialQueue(candidates) {
    const queue = [];
    for (const candidate of candidates) {
        queue.push(candidate);
    }
    return shuffleArrayCopy(queue);
}

function shuffleArrayCopy(array) {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
}
