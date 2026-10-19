import { getMillisecondsUntilNextReviewReset, getTodayDateString } from '../client/reviewScheduler.js';
import { runMasteredReviewDailyBatch } from './masteredReviewService.js';

export function startMasteredReviewScheduler({
    now = () => new Date(),
    schedule = setTimeout,
    cancel = clearTimeout,
    runBatch = runMasteredReviewDailyBatch,
    onError = error => console.error('后台回归复习任务失败，将在一分钟后重试：', error)
} = {}) {
    let stopped = false;
    let dailyTimer;
    let retryTimer;
    let running;
    let runningDate;

    const run = () => {
        if (stopped) return Promise.resolve();
        const today = getTodayDateString(now());
        if (running) return runningDate === today ? running : running.then(() => run());
        cancel(retryTimer);
        retryTimer = undefined;
        runningDate = today;
        running = Promise.resolve()
            .then(() => stopped ? undefined : runBatch(today))
            .catch(error => {
                if (stopped) return;
                onError(error);
                cancel(retryTimer);
                retryTimer = schedule(() => { retryTimer = undefined; return run(); }, 60_000);
                retryTimer.unref?.();
            })
            .finally(() => { running = null; });
        return running;
    };

    const scheduleNextReset = () => {
        if (stopped) return;
        dailyTimer = schedule(() => {
            scheduleNextReset();
            return run();
        }, getMillisecondsUntilNextReviewReset(now()));
        dailyTimer.unref?.();
    };

    scheduleNextReset();
    return {
        // Catch up today's missing run after a restart without replaying old days.
        ready: run(),
        stop() {
            stopped = true;
            cancel(dailyTimer);
            cancel(retryTimer);
        }
    };
}
