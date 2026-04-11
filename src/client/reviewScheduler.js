export const FORGET_SAME_DAY_TARGET = 3;
export const HARD_SAME_DAY_TARGET = 2;

export const EMPTY_SAME_DAY_REVIEW = {
    sameDayReviewDate: null,
    sameDayReviewDone: 0,
    sameDayReviewTarget: 0
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

export function normalizeReviewRecord(record, today = getTodayDateString()) {
    const normalized = {
        ...record,
        customMeaning: record.customMeaning || '',
        mastered: record.mastered ?? false,
        masteredDate: record.masteredDate || null,
        needsReadingPractice: record.needsReadingPractice ?? false,
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
