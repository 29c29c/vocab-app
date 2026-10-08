import { normalizeReviewRecord } from './reviewScheduler.js';
import * as recordCache from './recordCache.js';

const REQUEST_TIMEOUT_MS = 12000;
const FULL_DATA_TIMEOUT_MS = 30000;
const CACHE_TIMEOUT_MS = 5000;

export class RecordSync {
    constructor({ account, token, onRecords, onRecordCount = () => {}, onRemoteChanges = () => {}, onDataStatus, onSaveStatus, onUnauthorized, storage = recordCache }) {
        this.account = account;
        this.token = token;
        this.onRecords = onRecords;
        this.onRecordCount = onRecordCount;
        this.onRemoteChanges = onRemoteChanges;
        this.onDataStatus = onDataStatus;
        this.onSaveStatus = onSaveStatus;
        this.onUnauthorized = onUnauthorized;
        this.storage = storage;
        this.baseRecords = new Map();
        this.pending = [];
        this.mutationEpoch = 0;
        this.cacheWrites = Promise.resolve();
        this.controllers = new Set();
        this.stopped = false;
        this.storageReady = false;
        this.storageError = '';
        this.flushing = false;
        this.refreshPromise = null;
        this.retryDelay = 2000;
        this.refreshRetryDelay = 2000;
        this.conflictId = null;
        this.lastDataStatus = 'loading';
        this.hasFullSnapshot = false;
        this.recordCount = null;
        this.lastRefreshAt = 0;
        this.retryTimer = null;
        this.refreshRetryTimer = null;
        this.ready = this.initialize();
    }

    isActive() {
        return !this.stopped;
    }

    stop() {
        this.stopped = true;
        this.controllers.forEach(controller => controller.abort());
        this.controllers.clear();
        window.clearTimeout(this.retryTimer);
        window.clearTimeout(this.refreshRetryTimer);
    }

    queueCacheWrite(task) {
        const write = this.cacheWrites.then(task);
        this.cacheWrites = write.catch(() => {});
        return write;
    }

    publishRecords(status) {
        if (!this.isActive()) return;
        const records = new Map(this.baseRecords);
        this.pending.forEach(operation => {
            records.set(operation.record.id, operation.record);
        });
        this.onRecords(Array.from(records.values()).map(record => normalizeReviewRecord(record)));
        if (status) {
            this.lastDataStatus = status;
            this.onDataStatus(status);
        }
    }

    publishSaveStatus(error = '') {
        if (!this.isActive()) return;
        const message = error || this.storageError;
        this.onSaveStatus({
            status: this.conflictId ? 'conflict' : message ? 'error' : this.pending.length ? 'saving' : 'saved',
            pendingCount: this.pending.length,
            conflictId: this.conflictId,
            error: message
        });
    }

    async initialize() {
        let cacheTimeoutId;
        try {
            const cached = await Promise.race([
                this.storage.loadAccountCache(this.account),
                new Promise((_, reject) => {
                    cacheTimeoutId = window.setTimeout(() => reject(new Error('本地缓存读取超时')), CACHE_TIMEOUT_MS);
                })
            ]);
            if (!this.isActive()) return;
            this.storageReady = true;
            cached.records.forEach(record => this.baseRecords.set(record.id, record));
            this.pending = cached.pending;
            if (cached.complete || cached.records.length > 0 || cached.pending.length > 0) {
                this.publishRecords(cached.complete ? 'cached' : 'partial');
                this.recordCount = cached.count;
                this.onRecordCount(this.recordCount);
            }
            this.publishSaveStatus();
        } catch (error) {
            if (!this.isActive()) return;
            this.storageError = `本地存储不可用：${error.message}。复习操作已暂停。`;
            this.publishSaveStatus();
        } finally {
            window.clearTimeout(cacheTimeoutId);
        }
        if (this.isActive()) {
            if (this.baseRecords.size === 0 && this.pending.length === 0) void this.bootstrap();
            void this.refresh();
            if (this.storageReady) void this.flush();
        }
    }

    async bootstrap() {
        await this.ready;
        if (!this.isActive()) return;
        const requestEpoch = this.mutationEpoch;
        try {
            const response = await this.request('/api/data/bootstrap');
            if (!response.ok) return;
            const result = await response.json();
            if (!Number.isInteger(result.count) || !Array.isArray(result.records)) return;
            if (!this.isActive() || this.hasFullSnapshot || requestEpoch !== this.mutationEpoch) return;
            if (this.storageReady) {
                try {
                    await this.queueCacheWrite(() => {
                        if (this.hasFullSnapshot || requestEpoch !== this.mutationEpoch || !this.isActive()) return;
                        return this.storage.saveBootstrapSnapshot(this.account, result.records, result.count);
                    });
                } catch (error) {
                    this.storageReady = false;
                    this.storageError = `复习数据的本地缓存失败：${error.message}。复习操作已暂停。`;
                    this.publishSaveStatus();
                }
            }
            if (!this.isActive() || this.hasFullSnapshot || requestEpoch !== this.mutationEpoch) return;
            this.baseRecords = new Map(result.records.map(record => [record.id, record]));
            this.recordCount = result.count;
            this.onRecordCount(this.recordCount);
            this.publishRecords('partial');
        } catch {
            // The full snapshot request reports its own error and remains the fallback.
        }
    }

    async request(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
        const controller = new AbortController();
        this.controllers.add(controller);
        const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: { ...options.headers, Authorization: `Bearer ${this.token}` }
            });
            if (response.status === 401 && this.isActive()) {
                this.onUnauthorized();
                throw new Error('登录已过期');
            }
            // Keep the timeout active until the response body has finished downloading.
            const body = await response.text();
            return {
                ok: response.ok,
                status: response.status,
                json: async () => JSON.parse(body)
            };
        } finally {
            window.clearTimeout(timeoutId);
            this.controllers.delete(controller);
        }
    }

    async refresh() {
        await this.ready;
        if (!this.isActive()) return false;
        if (this.refreshPromise) return this.refreshPromise;
        this.refreshPromise = this.performRefresh();
        try {
            return await this.refreshPromise;
        } finally {
            this.refreshPromise = null;
        }
    }

    async performRefresh() {
        const requestEpoch = this.mutationEpoch;
        if (this.baseRecords.size === 0 && this.pending.length === 0
            && this.lastDataStatus !== 'partial' && this.lastDataStatus !== 'cached') {
            this.onDataStatus('loading');
        }
        try {
            const response = await this.request('/api/data', {}, FULL_DATA_TIMEOUT_MS);
            if (!response.ok) throw new Error(`获取单词失败（${response.status}）`);
            const records = await response.json();
            if (!Array.isArray(records)) throw new Error('服务器返回的单词数据格式错误');
            if (!this.isActive()) return false;
            if (requestEpoch !== this.mutationEpoch) {
                window.setTimeout(() => { if (this.isActive()) void this.refresh(); }, 0);
                return false;
            }
            this.hasFullSnapshot = true;
            if (this.storageReady) {
                try {
                    await this.queueCacheWrite(() => {
                        if (requestEpoch !== this.mutationEpoch || !this.isActive()) return;
                        return this.storage.replaceAccountSnapshot(this.account, records);
                    });
                    const hadStorageError = Boolean(this.storageError);
                    this.storageError = '';
                    if (hadStorageError) this.publishSaveStatus();
                } catch (error) {
                    this.storageError = `服务器数据已加载，但本地缓存更新失败：${error.message}`;
                    this.publishSaveStatus();
                }
            }
            if (!this.isActive()) return false;
            if (requestEpoch !== this.mutationEpoch) {
                window.setTimeout(() => { if (this.isActive()) void this.refresh(); }, 0);
                return false;
            }
            const changedIds = records
                .filter(record => {
                    const previous = this.baseRecords.get(record.id);
                    return previous && previous.revision !== record.revision
                        && !this.pending.some(operation => operation.record.id === record.id);
                })
                .map(record => record.id);
            this.baseRecords = new Map(records.map(record => [record.id, record]));
            if (changedIds.length > 0) this.onRemoteChanges(changedIds);
            window.clearTimeout(this.refreshRetryTimer);
            this.refreshRetryTimer = null;
            this.refreshRetryDelay = 2000;
            this.recordCount = records.length;
            this.lastRefreshAt = Date.now();
            this.onRecordCount(this.recordCount);
            this.publishRecords('success');
            return true;
        } catch (error) {
            if (!this.isActive()) return false;
            this.lastDataStatus = this.lastDataStatus === 'partial'
                ? 'partial'
                : this.lastDataStatus === 'cached' || this.baseRecords.size || this.pending.length ? 'cached' : 'error';
            this.onDataStatus(this.lastDataStatus, error.message);
            this.scheduleRefreshRetry();
            return false;
        }
    }

    async enqueueUpdate(record) {
        await this.ready;
        if (!this.isActive()) throw new Error('当前账户已切换');
        if (!this.storageReady) throw new Error('本地存储不可用，不能可靠保存复习操作');
        if (this.conflictId === record.id) throw new Error('该单词存在进度冲突，请先处理');
        if (!this.baseRecords.has(record.id)) throw new Error('单词尚未从服务器确认，不能修改');

        const latest = [...this.pending].reverse().find(operation => operation.record.id === record.id)?.record
            || this.baseRecords.get(record.id);
        if ((record.revision ?? 0) !== (latest.revision ?? 0)
            || (record.clientMutationId ?? null) !== (latest.clientMutationId ?? null)) {
            throw new Error('词条已在后台更新，请重新打开后再修改，避免覆盖新进度');
        }

        const mutationId = crypto.randomUUID();
        const operation = {
            account: this.account,
            mutationId,
            createdAt: Date.now(),
            record: { ...record, clientMutationId: mutationId }
        };
        this.mutationEpoch += 1;
        await this.queueCacheWrite(() => this.storage.enqueueRecordUpdate(operation));
        if (!this.isActive()) return;
        this.pending.push(operation);
        this.publishRecords();
        this.publishSaveStatus();
        void this.flush();
        return operation.record;
    }

    async flush() {
        await this.ready;
        if (!this.isActive() || this.flushing || this.conflictId || !this.storageReady) return;
        this.flushing = true;
        try {
            while (this.isActive() && this.pending.length > 0) {
                const operation = this.pending[0];
                const base = this.baseRecords.get(operation.record.id);
                if (!base) throw new Error('服务器记录缺失，待保存操作已保留');
                const response = await this.request(`/api/records/${operation.record.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...operation.record,
                        revision: base.revision ?? 0,
                        mutationId: operation.mutationId
                    })
                });
                if (response.status === 409) {
                    this.conflictId = operation.record.id;
                    this.publishSaveStatus('服务器有更新，本地进度已保留，请选择处理方式。');
                    break;
                }
                if (!response.ok) throw new Error(`保存复习进度失败（${response.status}）`);
                const result = await response.json();
                if (!result.success || !Number.isInteger(result.revision)) {
                    throw new Error('服务器没有确认复习进度版本');
                }
                const confirmed = { ...operation.record, revision: result.revision };
                await this.queueCacheWrite(() => this.storage.acknowledgeRecordUpdate(this.account, operation, confirmed));
                this.mutationEpoch += 1;
                this.baseRecords.set(confirmed.id, confirmed);
                this.pending.shift();
                this.retryDelay = 2000;
                this.publishRecords();
                this.publishSaveStatus();
            }
        } catch (error) {
            if (this.isActive()) {
                this.publishSaveStatus(`进度尚未保存到服务器：${error.message}`);
                this.scheduleRetry();
            }
        } finally {
            this.flushing = false;
        }
    }

    scheduleRetry() {
        if (!this.isActive() || this.retryTimer || this.conflictId) return;
        this.retryTimer = window.setTimeout(() => {
            this.retryTimer = null;
            void this.flush();
        }, this.retryDelay);
        this.retryDelay = Math.min(this.retryDelay * 2, 30000);
    }

    scheduleRefreshRetry() {
        if (!this.isActive() || this.refreshRetryTimer) return;
        this.refreshRetryTimer = window.setTimeout(() => {
            this.refreshRetryTimer = null;
            void this.refresh();
        }, this.refreshRetryDelay);
        this.refreshRetryDelay = Math.min(this.refreshRetryDelay * 2, 30000);
    }

    retry() {
        window.clearTimeout(this.retryTimer);
        this.retryTimer = null;
        window.clearTimeout(this.refreshRetryTimer);
        this.refreshRetryTimer = null;
        void this.refresh();
        void this.flush();
    }

    retryIfNeeded() {
        if (this.lastDataStatus !== 'success' || this.pending.length > 0
            || Date.now() - this.lastRefreshAt > 60000) this.retry();
    }

    async resolveConflict(useLocal) {
        await this.ready;
        if (!this.conflictId || !this.isActive()) return;
        const id = this.conflictId;
        try {
            const fresh = await this.refresh();
            if (!fresh) {
                this.publishSaveStatus('无法获取服务器最新版本，本地进度仍被保留。');
                return;
            }
            if (!useLocal) {
                const discarded = this.pending.filter(operation => operation.record.id === id);
                await this.queueCacheWrite(async () => {
                    for (const operation of discarded) {
                        await this.storage.discardPendingOperation(operation.mutationId);
                    }
                });
                this.pending = this.pending.filter(operation => operation.record.id !== id);
            }
            this.conflictId = null;
            this.publishRecords();
            this.publishSaveStatus();
            void this.flush();
        } catch (error) {
            this.publishSaveStatus(`处理冲突失败，本地进度仍被保留：${error.message}`);
        }
    }

    async createRecord(payload) {
        await this.ready;
        if (!this.isActive()) throw new Error('当前账户已切换');
        const response = await this.request('/api/records', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error('保存失败');
        const record = await response.json();
        if (!this.isActive()) throw new Error('当前账户已切换');
        this.mutationEpoch += 1;
        this.baseRecords.set(record.id, record);
        if (this.recordCount !== null) this.recordCount += 1;
        this.onRecordCount(this.recordCount);
        if (this.storageReady) {
            try {
                await this.queueCacheWrite(() => this.storage.saveConfirmedRecord(this.account, record));
            } catch (error) {
                this.publishSaveStatus(`单词已存入服务器，本地缓存更新失败：${error.message}`);
            }
        }
        this.publishRecords();
        return record;
    }

    async deleteRecord(id) {
        await this.ready;
        if (!this.isActive()) throw new Error('当前账户已切换');
        if (this.pending.some(operation => operation.record.id === id)) {
            throw new Error('该单词还有未保存的进度，请稍后删除');
        }
        const response = await this.request(`/api/records/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('删除失败');
        if (!this.isActive()) return;
        this.mutationEpoch += 1;
        this.baseRecords.delete(id);
        if (this.recordCount !== null) this.recordCount = Math.max(0, this.recordCount - 1);
        this.onRecordCount(this.recordCount);
        if (this.storageReady) {
            try {
                await this.queueCacheWrite(() => this.storage.deleteConfirmedRecord(this.account, id));
            } catch (error) {
                this.publishSaveStatus(`服务器已删除单词，本地缓存更新失败：${error.message}`);
            }
        }
        this.publishRecords();
    }
}
