const DB_NAME = 'vocab-record-cache-v1';
let databasePromise;

function requestResult(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error || new Error('本地存储事务中断'));
    });
}

function openCache() {
    if (!globalThis.indexedDB) {
        return Promise.reject(new Error('浏览器不支持安全保存待同步记录'));
    }
    if (!databasePromise) {
        databasePromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 2);
            let blocked = false;
            request.onupgradeneeded = () => {
                const database = request.result;
                if (!database.objectStoreNames.contains('records')) {
                    const records = database.createObjectStore('records', { keyPath: ['account', 'id'] });
                    records.createIndex('account', 'account');
                }
                if (!database.objectStoreNames.contains('outbox')) {
                    const outbox = database.createObjectStore('outbox', { keyPath: 'mutationId' });
                    outbox.createIndex('account', 'account');
                }
                if (!database.objectStoreNames.contains('meta')) {
                    database.createObjectStore('meta', { keyPath: 'account' });
                }
            };
            request.onblocked = () => {
                blocked = true;
                reject(new Error('其他页面占用旧版本地缓存，请关闭旧页面后重试'));
            };
            request.onsuccess = () => {
                if (blocked) request.result.close();
                else resolve(request.result);
            };
            request.onerror = () => reject(request.error);
        }).catch(error => {
            databasePromise = null;
            throw error;
        });
    }
    return databasePromise;
}

export async function loadAccountCache(account) {
    const database = await openCache();
    const transaction = database.transaction(['records', 'outbox', 'meta'], 'readonly');
    const done = transactionDone(transaction);
    const recordsRequest = transaction.objectStore('records').index('account').getAll(account);
    const outboxRequest = transaction.objectStore('outbox').index('account').getAll(account);
    const metaRequest = transaction.objectStore('meta').get(account);
    const [recordRows, pending, meta] = await Promise.all([
        requestResult(recordsRequest), requestResult(outboxRequest), requestResult(metaRequest)
    ]);
    await done;
    return {
        records: recordRows.map(row => {
            const record = { ...row };
            delete record.account;
            return record;
        }),
        complete: meta?.complete === true,
        count: Number.isInteger(meta?.count) ? meta.count : null,
        pending: pending.sort((left, right) => left.createdAt - right.createdAt)
    };
}

export async function replaceAccountSnapshot(account, records) {
    const database = await openCache();
    const transaction = database.transaction(['records', 'meta'], 'readwrite');
    const store = transaction.objectStore('records');
    transaction.objectStore('meta').put({ account, complete: true, count: records.length });
    const cursorRequest = store.index('account').openKeyCursor(account);
    cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) {
            records.forEach(record => store.put({ ...record, account }));
            return;
        }
        store.delete(cursor.primaryKey);
        cursor.continue();
    };
    await transactionDone(transaction);
}

export async function saveBootstrapSnapshot(account, records, count) {
    const database = await openCache();
    const transaction = database.transaction(['records', 'meta'], 'readwrite');
    const store = transaction.objectStore('records');
    const cursorRequest = store.index('account').openKeyCursor(account);
    transaction.objectStore('meta').put({ account, complete: false, count });
    cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) {
            records.forEach(record => store.put({ ...record, account }));
            return;
        }
        store.delete(cursor.primaryKey);
        cursor.continue();
    };
    await transactionDone(transaction);
}

export async function enqueueRecordUpdate(operation) {
    const database = await openCache();
    const transaction = database.transaction('outbox', 'readwrite');
    transaction.objectStore('outbox').add(operation);
    await transactionDone(transaction);
}

export async function discardPendingOperation(mutationId) {
    const database = await openCache();
    const transaction = database.transaction('outbox', 'readwrite');
    transaction.objectStore('outbox').delete(mutationId);
    await transactionDone(transaction);
}

export async function acknowledgeRecordUpdate(account, operation, record) {
    const database = await openCache();
    const transaction = database.transaction(['records', 'outbox'], 'readwrite');
    transaction.objectStore('records').put({ ...record, account });
    transaction.objectStore('outbox').delete(operation.mutationId);
    await transactionDone(transaction);
}

export async function saveConfirmedRecord(account, record) {
    const database = await openCache();
    const transaction = database.transaction(['records', 'meta'], 'readwrite');
    transaction.objectStore('records').put({ ...record, account });
    const metaStore = transaction.objectStore('meta');
    const metaRequest = metaStore.get(account);
    metaRequest.onsuccess = () => {
        const meta = metaRequest.result;
        if (meta && Number.isInteger(meta.count)) {
            metaStore.put({ ...meta, count: meta.count + 1 });
        }
    };
    await transactionDone(transaction);
}

export async function deleteConfirmedRecord(account, id) {
    const database = await openCache();
    const transaction = database.transaction(['records', 'meta'], 'readwrite');
    transaction.objectStore('records').delete([account, id]);
    const metaStore = transaction.objectStore('meta');
    const metaRequest = metaStore.get(account);
    metaRequest.onsuccess = () => {
        const meta = metaRequest.result;
        if (meta && Number.isInteger(meta.count)) {
            metaStore.put({ ...meta, count: Math.max(0, meta.count - 1) });
        }
    };
    await transactionDone(transaction);
}
