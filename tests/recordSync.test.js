import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RecordSync } from '../src/client/recordSync.js';

globalThis.window = { setTimeout, clearTimeout };

function createMemoryStorage(seed) {
    const records = new Map([['1', seed ? [seed] : []], ['2', []]]);
    const pending = new Map([['1', []], ['2', []]]);
    const meta = new Map([['1', { complete: Boolean(seed), count: seed ? 1 : null }], ['2', { complete: true, count: 0 }]]);
    return {
        records,
        pending,
        async loadAccountCache(account) {
            return { records: [...records.get(account)], pending: [...pending.get(account)], ...meta.get(account) };
        },
        async replaceAccountSnapshot(account, nextRecords) {
            records.set(account, [...nextRecords]);
            meta.set(account, { complete: true, count: nextRecords.length });
        },
        async saveBootstrapSnapshot(account, nextRecords, count) {
            records.set(account, [...nextRecords]);
            meta.set(account, { complete: false, count });
        },
        async enqueueRecordUpdate(operation) { pending.get(operation.account).push(operation); },
        async acknowledgeRecordUpdate(account, operation, record) {
            records.set(account, [
                ...records.get(account).filter(item => item.id !== record.id), record
            ]);
            pending.set(account, pending.get(account).filter(item => item.mutationId !== operation.mutationId));
        },
        async discardPendingOperation(mutationId) {
            for (const [account, items] of pending) {
                pending.set(account, items.filter(item => item.mutationId !== mutationId));
            }
        },
        async saveConfirmedRecord(account, record) { records.get(account).push(record); },
        async deleteConfirmedRecord(account, id) {
            records.set(account, records.get(account).filter(record => record.id !== id));
        }
    };
}

test('review bootstrap becomes usable before full download without overwriting a saved review', async () => {
    const initial = { id: 21, word: 'fast', reviewStage: 0, nextReviewDate: '2026-10-08', revision: 0 };
    const updated = { ...initial, reviewStage: 1, nextReviewDate: '2026-10-09', revision: 1 };
    const storage = createMemoryStorage(null);
    const originalFetch = globalThis.fetch;
    let releaseFull;
    let fullRequests = 0;
    const statuses = [];
    const counts = [];
    let latest = [];
    globalThis.fetch = async url => {
        if (url === '/api/data/bootstrap') {
            return new Response(JSON.stringify({ count: 3, records: [initial] }), { status: 200 });
        }
        if (url === '/api/data') {
            fullRequests += 1;
            if (fullRequests === 1) {
                return new Promise(resolve => {
                    releaseFull = () => resolve(new Response(JSON.stringify([initial]), { status: 200 }));
                });
            }
            return new Response(JSON.stringify([updated]), { status: 200 });
        }
        return new Response(JSON.stringify({ success: true, revision: 1 }), { status: 200 });
    };
    const sync = new RecordSync({
        account: '1', token: 'first', storage,
        onRecords: records => { latest = records; },
        onRecordCount: count => counts.push(count),
        onDataStatus: status => statuses.push(status),
        onSaveStatus: () => {}, onUnauthorized: () => {}
    });
    try {
        await sync.ready;
        await until(() => statuses.includes('partial') && Boolean(releaseFull));
        assert.equal(counts.at(-1), 3);
        assert.equal(latest[0].id, initial.id);
        await sync.enqueueUpdate({ ...initial, reviewStage: 1, nextReviewDate: '2026-10-09' });
        await until(() => storage.pending.get('1').length === 0);
        releaseFull();
        await until(() => statuses.at(-1) === 'success');
        assert.equal(latest[0].reviewStage, 1);
        assert.equal(storage.records.get('1')[0].reviewStage, 1);
        assert.equal(fullRequests, 2);
    } finally {
        sync.stop();
        globalThis.fetch = originalFetch;
    }
});

test('a failed conflict refresh keeps the pending review even if the user chose server data', async () => {
    const initial = { id: 22, word: 'conflict', reviewStage: 0, nextReviewDate: '2026-10-08', revision: 0 };
    const storage = createMemoryStorage(initial);
    const originalFetch = globalThis.fetch;
    let dataFails = false;
    globalThis.fetch = async url => {
        if (url === '/api/data') {
            if (dataFails) throw new Error('offline');
            return new Response(JSON.stringify([{ ...initial, revision: 1 }]), { status: 200 });
        }
        return new Response(JSON.stringify({ error: 'conflict' }), { status: 409 });
    };
    const sync = new RecordSync({
        account: '1', token: 'first', storage,
        onRecords: () => {}, onDataStatus: () => {}, onSaveStatus: () => {}, onUnauthorized: () => {}
    });
    try {
        await sync.ready;
        await sync.enqueueUpdate({ ...initial, reviewStage: 1 });
        await until(() => sync.conflictId === initial.id);
        dataFails = true;
        await sync.resolveConflict(false);
        assert.equal(storage.pending.get('1').length, 1);
        assert.equal(sync.conflictId, initial.id);
        dataFails = false;
        await sync.resolveConflict(false);
        assert.equal(storage.pending.get('1').length, 0);
        assert.equal(sync.conflictId, null);
    } finally {
        sync.stop();
        globalThis.fetch = originalFetch;
    }
});

test('stale local edits are rejected after a review or a remote version change', async () => {
    const initial = { id: 23, word: 'stale', reviewStage: 0, nextReviewDate: '2026-10-08', revision: 0 };
    const storage = createMemoryStorage(initial);
    const originalFetch = globalThis.fetch;
    let remoteRevision = 0;
    const remoteChanges = [];
    let latest = [];
    globalThis.fetch = async url => {
        if (url === '/api/data') {
            return new Response(JSON.stringify([{ ...initial, revision: remoteRevision }]), { status: 200 });
        }
        remoteRevision = 1;
        return new Response(JSON.stringify({ success: true, revision: 1 }), { status: 200 });
    };
    const sync = new RecordSync({
        account: '1', token: 'first', storage,
        onRecords: records => { latest = records; },
        onRemoteChanges: ids => remoteChanges.push(...ids),
        onDataStatus: () => {}, onSaveStatus: () => {}, onUnauthorized: () => {}
    });
    try {
        await sync.ready;
        const accepted = await sync.enqueueUpdate({ ...initial, reviewStage: 1 });
        assert.ok(accepted.clientMutationId);
        await assert.rejects(sync.enqueueUpdate({ ...initial, reviewStage: 2 }), /后台更新/);
        await until(() => storage.pending.get('1').length === 0);
        assert.equal(latest[0].revision, 1);
        remoteRevision = 2;
        await sync.refresh();
        assert.deepEqual(remoteChanges, [initial.id]);
        await assert.rejects(sync.enqueueUpdate(accepted), /后台更新/);
    } finally {
        sync.stop();
        globalThis.fetch = originalFetch;
    }
});

async function until(predicate) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
        if (predicate()) return;
        await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw new Error('condition was not reached');
}

test('frontend loading and refreshing only read records and never request a recall draw', async () => {
    const storage = createMemoryStorage(null);
    const originalFetch = globalThis.fetch;
    const requests = [];
    globalThis.fetch = async (url, options) => {
        requests.push({ url, method: options.method || 'GET' });
        return new Response(JSON.stringify(url.endsWith('/bootstrap') ? { count: 0, records: [] } : []));
    };
    const sync = new RecordSync({
        account: '1', token: 'first', storage,
        onRecords: () => {}, onDataStatus: () => {}, onSaveStatus: () => {}, onUnauthorized: () => {}
    });
    try {
        await sync.ready;
        await sync.refresh();
        await sync.refresh();
        assert.ok(requests.length >= 2);
        assert.ok(requests.every(request => request.method === 'GET'));
        assert.ok(requests.every(request => ['/api/data', '/api/data/bootstrap'].includes(request.url)));
    } finally {
        sync.stop();
        globalThis.fetch = originalFetch;
    }
});

test('offline review remains queued across a restart and is isolated by account', async () => {
    const initial = { id: 7, word: 'alpha', reviewStage: 0, nextReviewDate: '2026-10-08', revision: 0 };
    const storage = createMemoryStorage(initial);
    const originalFetch = globalThis.fetch;
    let online = false;
    globalThis.fetch = async (url, options) => {
        if (url === '/api/data') {
            const data = options.headers.Authorization === 'Bearer first' ? [initial] : [];
            return new Response(JSON.stringify(data), { status: 200 });
        }
        if (!online) throw new Error('offline');
        return new Response(JSON.stringify({ success: true, revision: 1 }), { status: 200 });
    };

    const statuses = [];
    const observed = [];
    const makeSync = (account, token) => new RecordSync({
        account, token, storage,
        onRecords: records => observed.push({ account, records }),
        onDataStatus: () => {},
        onSaveStatus: status => statuses.push({ account, ...status }),
        onUnauthorized: () => { throw new Error('unexpected 401'); }
    });

    let first;
    let resumed;
    let second;
    try {
        first = makeSync('1', 'first');
        await first.ready;
        await first.enqueueUpdate({ ...initial, reviewStage: 1, nextReviewDate: '2026-10-09' });
        await until(() => statuses.some(status => status.account === '1' && status.status === 'error'));
        assert.equal(storage.pending.get('1').length, 1);
        assert.equal(observed.at(-1).records[0].reviewStage, 1);
        first.stop();

        second = makeSync('2', 'second');
        await second.ready;
        await until(() => observed.some(entry => entry.account === '2'));
        assert.equal(observed.filter(entry => entry.account === '2').at(-1).records.length, 0);
        second.stop();

        online = true;
        resumed = makeSync('1', 'first');
        await resumed.ready;
        await until(() => storage.pending.get('1').length === 0);
        assert.equal(storage.records.get('1')[0].reviewStage, 1);
        assert.equal(storage.records.get('1')[0].revision, 1);
        assert.equal(statuses.filter(status => status.account === '1').at(-1).status, 'saved');
    } finally {
        first?.stop();
        resumed?.stop();
        second?.stop();
        globalThis.fetch = originalFetch;
    }
});

test('a late data response cannot replace a newer review result', async () => {
    const initial = { id: 8, word: 'beta', reviewStage: 0, nextReviewDate: '2026-10-08', revision: 0 };
    const storage = createMemoryStorage(initial);
    const originalFetch = globalThis.fetch;
    let releaseFirstGet;
    let getCount = 0;
    globalThis.fetch = async url => {
        if (url === '/api/data') {
            getCount += 1;
            if (getCount === 1) {
                return new Promise(resolve => { releaseFirstGet = () => resolve(new Response(JSON.stringify([initial]), { status: 200 })); });
            }
            return new Response(JSON.stringify(storage.records.get('1')), { status: 200 });
        }
        return new Response(JSON.stringify({ success: true, revision: 1 }), { status: 200 });
    };
    let latest = [];
    const sync = new RecordSync({
        account: '1', token: 'first', storage,
        onRecords: records => { latest = records; },
        onDataStatus: () => {}, onSaveStatus: () => {}, onUnauthorized: () => {}
    });
    try {
        await sync.ready;
        await until(() => Boolean(releaseFirstGet));
        await sync.enqueueUpdate({ ...initial, reviewStage: 1, nextReviewDate: '2026-10-09' });
        await until(() => storage.pending.get('1').length === 0);
        releaseFirstGet();
        await until(() => getCount >= 2);
        assert.equal(latest[0].reviewStage, 1);
        assert.equal(storage.records.get('1')[0].reviewStage, 1);
    } finally {
        sync.stop();
        globalThis.fetch = originalFetch;
    }
});

test('a stopped account ignores a response that arrives after account switching', async () => {
    const initial = { id: 9, word: 'first-only', reviewStage: 0, nextReviewDate: '2026-10-08', revision: 0 };
    const storage = createMemoryStorage(initial);
    const originalFetch = globalThis.fetch;
    let releaseOldGet;
    globalThis.fetch = async (url, options) => {
        if (url === '/api/data' && options.headers.Authorization === 'Bearer first') {
            return new Promise(resolve => { releaseOldGet = () => resolve(new Response(JSON.stringify([initial]), { status: 200 })); });
        }
        return new Response('[]', { status: 200 });
    };
    const seen = [];
    const first = new RecordSync({
        account: '1', token: 'first', storage,
        onRecords: records => seen.push({ account: '1', records }),
        onDataStatus: () => {}, onSaveStatus: () => {}, onUnauthorized: () => {}
    });
    let second;
    try {
        await first.ready;
        await until(() => Boolean(releaseOldGet));
        first.stop();
        const beforeLateResponse = seen.length;
        second = new RecordSync({
            account: '2', token: 'second', storage,
            onRecords: records => seen.push({ account: '2', records }),
            onDataStatus: () => {}, onSaveStatus: () => {}, onUnauthorized: () => {}
        });
        await second.ready;
        releaseOldGet();
        await until(() => seen.some(entry => entry.account === '2'));
        assert.equal(seen.filter(entry => entry.account === '1').length, beforeLateResponse);
        assert.equal(seen.filter(entry => entry.account === '2').at(-1).records.length, 0);
    } finally {
        first.stop();
        second?.stop();
        globalThis.fetch = originalFetch;
    }
});

test('consecutive reviews for one record are sent in version order', async () => {
    const initial = { id: 10, word: 'gamma', reviewStage: 0, nextReviewDate: '2026-10-08', revision: 0 };
    const storage = createMemoryStorage(initial);
    const originalFetch = globalThis.fetch;
    const sent = [];
    let serverRecord = initial;
    globalThis.fetch = async (url, options) => {
        if (url === '/api/data') return new Response(JSON.stringify([serverRecord]), { status: 200 });
        const payload = JSON.parse(options.body);
        sent.push({ revision: payload.revision, stage: payload.reviewStage });
        serverRecord = { ...payload, revision: payload.revision + 1 };
        return new Response(JSON.stringify({ success: true, revision: payload.revision + 1 }), { status: 200 });
    };
    const sync = new RecordSync({
        account: '1', token: 'first', storage,
        onRecords: () => {}, onDataStatus: () => {}, onSaveStatus: () => {}, onUnauthorized: () => {}
    });
    try {
        await sync.ready;
        const firstUpdate = await sync.enqueueUpdate({ ...initial, reviewStage: 1 });
        await sync.enqueueUpdate({ ...firstUpdate, reviewStage: 2 });
        await until(() => storage.pending.get('1').length === 0 && sent.length === 2);
        assert.deepEqual(sent, [{ revision: 0, stage: 1 }, { revision: 1, stage: 2 }]);
        assert.equal(storage.records.get('1')[0].reviewStage, 2);
    } finally {
        sync.stop();
        globalThis.fetch = originalFetch;
    }
});
