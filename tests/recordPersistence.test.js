import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'vocab-record-test-'));
process.env.DB_PATH = path.join(temporaryDirectory, 'records.sqlite');
process.env.JWT_SECRET = 'test-only-secret';
process.env.ADMIN_USERNAMES = 'test-admin';

const { databaseReady } = await import('../src/db/index.js');
const users = await import('../src/repositories/userRepository.js');
const records = await import('../src/services/recordsService.js');
const data = await import('../src/services/dataService.js');
const { validateUpdateRecordPayload } = await import('../src/validators/recordValidators.js');

await databaseReady;
after(async () => {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
});

test('record updates are account-scoped, idempotent, and reject stale versions', async () => {
    const firstUser = await users.createUser({ username: 'first', passwordHash: 'unused' });
    const secondUser = await users.createUser({ username: 'second', passwordHash: 'unused' });
    const created = await records.createRecord(firstUser.lastID, {
        date: '2026-10-08', word: 'alpha', sentence: 'sample'
    });

    assert.equal((await data.getUserData(secondUser.lastID)).length, 0);
    const update = validateUpdateRecordPayload({
        ...created,
        reviewStage: 1,
        nextReviewDate: '2026-10-09',
        revision: 0,
        mutationId: 'review-1'
    });
    await assert.rejects(records.updateRecord(secondUser.lastID, created.id, update), { statusCode: 404 });

    assert.equal((await records.updateRecord(firstUser.lastID, created.id, update)).revision, 1);
    assert.equal((await records.updateRecord(firstUser.lastID, created.id, update)).revision, 1);
    await assert.rejects(
        records.updateRecord(firstUser.lastID, created.id, { ...update, mutationId: 'review-2' }),
        { statusCode: 409 }
    );

    const saved = await data.getUserData(firstUser.lastID);
    assert.equal(saved.length, 1);
    assert.equal(saved[0].reviewStage, 1);
    assert.equal(saved[0].revision, 1);
});

test('review bootstrap returns only this account’s due records and an exact total count', async () => {
    const firstUser = await users.createUser({ username: 'bootstrap-first', passwordHash: 'unused' });
    const secondUser = await users.createUser({ username: 'bootstrap-second', passwordHash: 'unused' });
    const due = await records.createRecord(firstUser.lastID, {
        date: '2026-10-08', word: 'due', sentence: 'due sentence'
    });
    await records.createRecord(firstUser.lastID, {
        date: '2026-10-10', word: 'later', sentence: 'later sentence'
    });
    await records.createRecord(secondUser.lastID, {
        date: '2026-10-08', word: 'other-account', sentence: 'other sentence'
    });
    const bootstrap = await data.getReviewBootstrap(firstUser.lastID, '2026-10-08');
    assert.equal(bootstrap.count, 2);
    assert.deepEqual(bootstrap.records.map(record => record.id), [due.id]);
    assert.equal(bootstrap.records[0].sentence, 'due sentence');
});
