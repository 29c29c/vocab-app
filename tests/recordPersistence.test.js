import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'vocab-record-test-'));
process.env.DB_PATH = path.join(temporaryDirectory, 'records.sqlite');
process.env.JWT_SECRET = 'test-only-secret';
process.env.ADMIN_USERNAMES = 'test-admin';

const { databaseReady } = await import('../src/db/index.js');
const users = await import('../src/repositories/userRepository.js');
const records = await import('../src/services/recordsService.js');
const data = await import('../src/services/dataService.js');
const auth = await import('../src/services/authService.js');
const { createAuthenticateToken } = await import('../src/middleware/authenticateToken.js');
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

test('legacy replacement requires a current snapshot and cannot erase the account with an empty array', async () => {
    const user = await users.createUser({ username: 'legacy-import', passwordHash: 'unused' });
    await records.createRecord(user.lastID, { date: '2026-10-08', word: 'original' });
    const snapshot = await data.getUserData(user.lastID);
    const etag = data.getDataEtag(snapshot);

    await assert.rejects(data.replaceUserData(user.lastID, [{ word: 'new' }]), { statusCode: 428 });
    await assert.rejects(data.replaceUserData(user.lastID, [], etag), { statusCode: 400 });
    await records.createRecord(user.lastID, { date: '2026-10-09', word: 'newer' });
    await assert.rejects(data.replaceUserData(user.lastID, [{ word: 'stale' }], etag), { statusCode: 409 });
    assert.deepEqual((await data.getUserData(user.lastID)).map(record => record.word), ['original', 'newer']);

    const freshEtag = data.getDataEtag(await data.getUserData(user.lastID));
    await data.replaceUserData(user.lastID, [{ word: 'replacement', date: '2026-10-09' }], freshEtag);
    assert.deepEqual((await data.getUserData(user.lastID)).map(record => record.word), ['replacement']);

    const racingEtag = data.getDataEtag(await data.getUserData(user.lastID));
    const createPromise = records.createRecord(user.lastID, { date: '2026-10-09', word: 'concurrent' });
    const replacePromise = data.replaceUserData(user.lastID, [{ word: 'stale-again' }], racingEtag);
    await createPromise;
    await assert.rejects(replacePromise, { statusCode: 409 });
    assert.deepEqual((await data.getUserData(user.lastID)).map(record => record.word), ['replacement', 'concurrent']);
});

test('login tokens expire after seven days', async () => {
    const password = 'test-password';
    await users.createUser({ username: 'expiring-token', passwordHash: await bcrypt.hash(password, 4) });
    const { token } = await auth.loginUser({ username: 'expiring-token', password }, { jwtSecret: process.env.JWT_SECRET });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    assert.equal(payload.exp - payload.iat, 7 * 24 * 60 * 60);

    const legacyToken = jwt.sign({ id: 1, username: 'old' }, process.env.JWT_SECRET);
    let statusCode;
    const response = {
        status(code) { statusCode = code; return this; },
        json() { return this; }
    };
    await createAuthenticateToken({ jwtSecret: process.env.JWT_SECRET })(
        { headers: { authorization: `Bearer ${legacyToken}` } }, response, () => assert.fail('legacy token should be rejected')
    );
    assert.equal(statusCode, 401);

    await auth.logoutUser(payload);
    statusCode = undefined;
    await createAuthenticateToken({ jwtSecret: process.env.JWT_SECRET })(
        { headers: { authorization: `Bearer ${token}` } }, response, () => assert.fail('revoked token should be rejected')
    );
    assert.equal(statusCode, 401);
});
