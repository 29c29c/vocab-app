import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DEFAULT_APP_SETTINGS, normalizeAppSettings } from '../src/client/defaultSettings.js';
import { scheduleReviewResult } from '../src/client/reviewScheduler.js';
import { validateSettingsPayload } from '../src/validators/settingsValidators.js';
import { validateUpdateRecordPayload } from '../src/validators/recordValidators.js';
import { validateLegacyImportPayload } from '../src/validators/dataValidators.js';

const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'vocab-mastered-test-'));
process.env.DB_PATH = path.join(directory, 'records.sqlite');
process.env.JWT_SECRET = 'test-only-mastered-secret';
process.env.ADMIN_USERNAMES = 'test-admin';
const { databaseReady } = await import('../src/db/index.js');
const users = await import('../src/repositories/userRepository.js');
const records = await import('../src/services/recordsService.js');
const data = await import('../src/services/dataService.js');
const settings = await import('../src/services/settingsService.js');
const { prepareMasteredReviews, runMasteredReviewDailyBatch } = await import('../src/services/masteredReviewService.js');
const { startMasteredReviewScheduler } = await import('../src/services/masteredReviewScheduler.js');
await databaseReady;
after(() => fs.rm(directory, { recursive: true, force: true }));

const TODAY = '2026-10-19';
let mutation = 0;
async function save(userId, record, patch = {}) {
    const payload = validateUpdateRecordPayload({ ...record, ...patch, mutationId: `mastered-test-${++mutation}` });
    const result = await records.updateRecord(userId, record.id, payload);
    return { ...record, ...patch, revision: result.revision };
}
async function createMastered(userId, word, masteredDate = '2026-08-01') {
    const record = await records.createRecord(userId, { word, date: '2026-08-01' });
    return save(userId, record, { mastered: true, masteredDate, reviewStage: 7 });
}
async function enabledUser(username, patch = {}) {
    const user = await users.createUser({ username, passwordHash: 'unused' });
    await settings.saveSettings(user.lastID, { masteredReviewEnabled: true, ...patch });
    return user.lastID;
}

test('recall settings are opt-in, persist per account, and reject invalid quotas and ages', async () => {
    assert.equal(DEFAULT_APP_SETTINGS.masteredReviewEnabled, false);
    assert.equal(DEFAULT_APP_SETTINGS.masteredReviewDailyCount, 10);
    assert.equal(DEFAULT_APP_SETTINGS.masteredReviewMinDays, 30);
    const id = await enabledUser('settings', { masteredReviewDailyCount: 3, masteredReviewMinDays: 45 });
    const loaded = await settings.getSettings(id);
    assert.equal(loaded.masteredReviewDailyCount, 3);
    assert.equal(loaded.masteredReviewMinDays, 45);
    assert.equal(normalizeAppSettings({ masteredReviewDailyCount: -1 }).masteredReviewDailyCount, 10);
    for (const patch of [
        { masteredReviewDailyCount: 0 }, { masteredReviewDailyCount: 1.5 },
        { masteredReviewDailyCount: 1001 }, { masteredReviewMinDays: -1 },
        { masteredReviewMinDays: '30' }, { masteredReviewEnabled: 'yes' }
    ]) assert.throws(() => validateSettingsPayload(patch), { statusCode: 400 });
    assert.equal(validateSettingsPayload({ masteredReviewMinDays: 0 }).masteredReviewMinDays, 0);
});

test('draws honor exact mastery age, record missing dates from today, and isolate accounts', async () => {
    const id = await enabledUser('age-boundary');
    const other = await enabledUser('other-account');
    const eligible = await createMastered(id, 'boundary', '2026-09-19');
    await createMastered(id, 'recent', '2026-09-20');
    const missing = await createMastered(id, 'missing-date', null);
    await createMastered(other, 'private');
    assert.equal((await prepareMasteredReviews(id, TODAY)).selected, 1);
    const snapshot = await data.getUserData(id);
    const drawn = snapshot.filter(record => record.isMasteredReview);
    assert.deepEqual(drawn.map(record => record.id), [eligible.id]);
    assert.equal(drawn[0].mastered, false);
    assert.equal(drawn[0].reviewStage, 7);
    assert.equal(drawn[0].masteredDate, '2026-09-19');
    assert.equal(drawn[0].masteredReviewDate, TODAY);
    assert.equal(drawn[0].nextReviewDate, TODAY);
    assert.equal(snapshot.find(record => record.id === missing.id).masteredDate, TODAY);
    assert.equal((await data.getUserData(other))[0].mastered, true);
    const bootstrap = await data.getReviewBootstrap(id, TODAY);
    assert.deepEqual(bootstrap.records.map(record => record.id), [eligible.id]);
    await assert.rejects(save(id, eligible, { customMeaning: 'stale edit' }), { statusCode: 409 });
});

test('concurrent draws and refreshes share a quota that survives successful ratings', async () => {
    const id = await enabledUser('daily-quota', { masteredReviewMinDays: 0 });
    for (let i = 0; i < 15; i++) await createMastered(id, `old-${i}`);
    const draws = await Promise.all(Array.from({ length: 5 }, () => prepareMasteredReviews(id, TODAY)));
    assert.equal(draws.reduce((sum, result) => sum + result.selected, 0), 10);
    const recalled = (await data.getUserData(id)).filter(record => record.isMasteredReview);
    assert.equal(recalled.length, 10);
    assert.equal(new Set(recalled.map(record => record.id)).size, 10);
    for (const record of recalled) await save(id, record, scheduleReviewResult(record, 'easy', TODAY).record);
    assert.equal((await prepareMasteredReviews(id, TODAY)).selected, 0);
    const completed = await data.getUserData(id);
    assert.equal(completed.filter(record => record.isMasteredReview).length, 0);
    assert.equal(completed.filter(record => record.masteredReviewDate === TODAY).length, 10);
    assert.ok(completed.every(record => record.mastered));
    assert.equal((await prepareMasteredReviews(id, '2026-10-20')).selected, 10);
});

test('turning recall off stops new draws and preserves the existing backlog', async () => {
    const id = await enabledUser('disable-recall', { masteredReviewDailyCount: 2 });
    for (let i = 0; i < 4; i++) await createMastered(id, `disable-${i}`);
    await prepareMasteredReviews(id, TODAY);
    const [first, second] = (await data.getUserData(id)).filter(record => record.isMasteredReview);
    const failed = await save(id, first, scheduleReviewResult(first, 'forget', TODAY).record);
    await settings.saveSettings(id, { masteredReviewEnabled: false });
    await prepareMasteredReviews(id, TODAY);
    const snapshot = await data.getUserData(id);
    const pending = snapshot.find(record => record.id === second.id);
    assert.equal(pending.mastered, false);
    assert.equal(pending.isMasteredReview, true);
    assert.equal(pending.masteredDate, '2026-08-01');
    const normal = snapshot.find(record => record.id === failed.id);
    assert.equal(normal.mastered, false);
    assert.equal(normal.reviewStage, 0);
    assert.equal(normal.sameDayReviewTarget, 3);
    assert.equal((await prepareMasteredReviews(id, '2026-10-20')).selected, 0);
    assert.equal((await data.getUserData(id)).filter(record => record.isMasteredReview).length, 1);
    await settings.saveSettings(id, { masteredReviewEnabled: true });
    assert.equal((await prepareMasteredReviews(id, TODAY)).selected, 0);
});

test('disabled accounts do not draw and quota changes apply to the next daily run', async () => {
    const user = await users.createUser({ username: 'opt-in', passwordHash: 'unused' });
    const id = user.lastID;
    for (let i = 0; i < 5; i++) await createMastered(id, `quota-${i}`);
    assert.equal((await prepareMasteredReviews(id, TODAY)).selected, 0);
    await settings.saveSettings(id, { masteredReviewEnabled: true, masteredReviewDailyCount: 2 });
    assert.equal((await prepareMasteredReviews(id, TODAY)).selected, 2);
    await settings.saveSettings(id, { masteredReviewDailyCount: 4 });
    assert.equal((await prepareMasteredReviews(id, TODAY)).selected, 0);
    await settings.saveSettings(id, { masteredReviewDailyCount: 1 });
    assert.equal((await prepareMasteredReviews(id, TODAY)).selected, 0);
    assert.equal((await prepareMasteredReviews(id, '2026-10-20')).selected, 1);
});

test('recall labels, mastery dates, and quota dates survive record updates and export/import', async () => {
    const id = await enabledUser('round-trip', { masteredReviewDailyCount: 1 });
    await createMastered(id, 'round-trip-word');
    await prepareMasteredReviews(id, TODAY);
    const [recalled] = await data.getUserData(id);
    const edited = await save(id, recalled, { customMeaning: 'still recalled' });
    let [saved] = await data.getUserData(id);
    assert.equal(saved.isMasteredReview, true);
    assert.equal(saved.masteredReviewDate, TODAY);
    const imported = validateLegacyImportPayload([saved]);
    await data.replaceUserData(id, imported, data.getDataEtag([saved]));
    [saved] = await data.getUserData(id);
    assert.equal(saved.isMasteredReview, true);
    assert.equal(saved.masteredReviewDate, TODAY);
    assert.equal(saved.masteredDate, edited.masteredDate);
    const graded = await save(id, saved, scheduleReviewResult(saved, 'easy', TODAY).record);
    assert.equal(graded.masteredDate, TODAY);
    assert.equal((await data.getUserData(id))[0].masteredReviewDate, TODAY);
    assert.equal((await prepareMasteredReviews(id, TODAY)).selected, 0);
});

function fakeClock(instant) {
    let current = new Date(instant);
    const timers = new Set();
    return {
        now: () => new Date(current),
        set: value => { current = new Date(value); },
        schedule(callback, delay) {
            const timer = { callback, delay, unref() {} };
            timers.add(timer);
            return timer;
        },
        cancel: timer => timers.delete(timer),
        timers,
        fire(timer) { timers.delete(timer); return timer.callback(); }
    };
}

test('server-only 04:00 jobs add each account’s quota every day on top of unfinished words', async () => {
    const id = await enabledUser('background-daily', { masteredReviewDailyCount: 2 });
    const other = await enabledUser('background-other-quota', { masteredReviewDailyCount: 3 });
    const off = await users.createUser({ username: 'background-disabled', passwordHash: 'unused' });
    for (let i = 0; i < 7; i++) await createMastered(id, `background-${i}`);
    for (let i = 0; i < 10; i++) await createMastered(other, `other-background-${i}`);
    await createMastered(off.lastID, 'never-drawn');
    // Loading review data does not draw anything.
    assert.equal((await data.getReviewBootstrap(id, TODAY)).records.length, 0);
    const clock = fakeClock('2026-10-19T19:59:00Z'); // Beijing 03:59, review day Oct 19.
    const scheduler = startMasteredReviewScheduler(clock);
    try {
        await scheduler.ready;
        assert.equal((await data.getUserData(id)).filter(record => record.isMasteredReview).length, 2);
        assert.equal((await data.getUserData(other)).filter(record => record.isMasteredReview).length, 3);
        const firstReset = [...clock.timers][0];
        assert.equal(firstReset.delay, 60_000);
        clock.set('2026-10-19T20:00:00Z'); // Beijing 04:00, Oct 20.
        await clock.fire(firstReset);
        const backlog = (await data.getUserData(id)).filter(record => record.isMasteredReview);
        assert.equal(backlog.length, 4);
        assert.equal(backlog.filter(record => record.masteredReviewDate === TODAY).length, 2);
        assert.equal(backlog.filter(record => record.masteredReviewDate === '2026-10-20').length, 2);
        assert.equal((await data.getUserData(other)).filter(record => record.isMasteredReview).length, 6);
        assert.equal((await data.getUserData(off.lastID))[0].isMasteredReview, false);
        const nextReset = [...clock.timers][0];
        assert.equal(nextReset.delay, 86_400_000);
        clock.set('2026-10-20T20:00:00Z');
        await clock.fire(nextReset);
        assert.equal((await data.getUserData(id)).filter(record => record.isMasteredReview).length, 6);
        assert.equal((await data.getUserData(other)).filter(record => record.isMasteredReview).length, 9);
        assert.equal((await data.getReviewBootstrap(id, '2026-10-21')).records.length, 6);
    } finally {
        scheduler.stop();
    }
    // A fresh server instance on the same day cannot repeat the draw.
    const restarted = startMasteredReviewScheduler(clock);
    try {
        await restarted.ready;
        assert.equal((await data.getUserData(id)).filter(record => record.isMasteredReview).length, 6);
    } finally {
        restarted.stop();
    }
});

test('an empty daily draw is recorded and cannot be retriggered later that day', async () => {
    const id = await enabledUser('empty-daily-run');
    assert.equal((await prepareMasteredReviews(id, TODAY)).selected, 0);
    await createMastered(id, 'imported-after-reset');
    assert.equal((await prepareMasteredReviews(id, TODAY)).selected, 0);
    assert.equal((await prepareMasteredReviews(id, '2026-10-20')).selected, 1);
});

test('the background scheduler retries failures without frontend requests and can stop cleanly', async () => {
    const clock = fakeClock('2026-10-19T12:00:00Z');
    let attempts = 0;
    const errors = [];
    const scheduler = startMasteredReviewScheduler({
        ...clock,
        runBatch: async () => { if (++attempts === 1) throw new Error('temporary database failure'); },
        onError: error => errors.push(error)
    });
    await scheduler.ready;
    assert.equal(errors.length, 1);
    const retry = [...clock.timers].find(timer => timer.delay === 60_000);
    assert.ok(retry);
    await clock.fire(retry);
    assert.equal(attempts, 2);
    const daily = [...clock.timers][0];
    scheduler.stop();
    assert.equal(clock.timers.size, 0);
    await daily.callback();
    assert.equal(attempts, 2);
});

test('a run spanning 04:00 queues the new day instead of skipping its draw', async () => {
    const clock = fakeClock('2026-10-19T19:59:59Z');
    const days = [];
    let release;
    const scheduler = startMasteredReviewScheduler({
        ...clock,
        runBatch: today => {
            days.push(today);
            return days.length === 1 ? new Promise(resolve => { release = resolve; }) : Promise.resolve();
        }
    });
    await Promise.resolve();
    clock.set('2026-10-19T20:00:00Z');
    const nextRun = clock.fire([...clock.timers][0]);
    assert.deepEqual(days, ['2026-10-19']);
    release();
    await scheduler.ready;
    await nextRun;
    assert.deepEqual(days, ['2026-10-19', '2026-10-20']);
    scheduler.stop();
});
