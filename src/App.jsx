import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    BookOpen, Calendar, BarChart2, Trash2, X,
    Sparkles, BrainCircuit, FileSpreadsheet, Filter,
    Printer, Trophy, Zap
} from 'lucide-react';
import { requestAiCompletion } from './client/aiApi.js';
import { getAccountId } from './client/authIdentity.js';
import { requestDictionaryLookup } from './client/dictionaryApi.js';
import { DEFAULT_APP_SETTINGS, hasAiConfig, normalizeAppSettings } from './client/defaultSettings.js';
import {
    applyReviewPerformance,
    getCalendarDateString,
    getFutureDateString,
    getMillisecondsUntilNextReviewReset,
    clearSameDayReviewFields,
    clearFocusReviewFields,
    getTodayDateString,
    isSameDayReviewActive,
    maybeExitFocusReview,
    normalizeReviewRecord,
    progressSameDayReview,
    reconcileReviewQueue,
    reinsertReviewItem,
    sortFocusRecords,
    startSameDayReview
} from './client/reviewScheduler.js';
import { readSettingsCache, writeSettingsCache } from './client/settingsCache.js';
import { RecordSync } from './client/recordSync.js';
import { loadXlsxLibrary } from './client/xlsxLoader.js';
import { escapeHtml } from './client/escapeHtml.js';
import { getAiProviderPreset } from './shared/aiProviders.js';
import AppHeader from './components/AppHeader.jsx';
import ArticleAnalyzer from './components/ArticleAnalyzer.jsx';
import AuthScreen from './components/AuthScreen.jsx';
import DateArchiveView from './components/DateArchiveView.jsx';
import FrequencyView from './components/FrequencyView.jsx';
import InputView from './components/InputView.jsx';
import ListView from './components/ListView.jsx';
import MeaningSection from './components/MeaningSection.jsx';
import ReviewView from './components/ReviewView.jsx';
import WritingPolisher from './components/WritingPolisher.jsx';

// 生产环境使用相对路径，本地开发如果是 3001 端口可能需要调整
const API_BASE = '/api';

// --- 辅助工具：洗牌算法 (Fisher-Yates) ---
const shuffleArray = (array) => {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
};

const createLookupPanelEntry = (isAiEnabled) => ({
    aiError: isAiEnabled ? '' : '未配置 AI，可稍后在词条详情中手动生成。',
    aiResult: null,
    aiStatus: isAiEnabled ? 'loading' : 'idle',
    dictionaryError: '',
    dictionaryResult: null,
    dictionaryStatus: 'loading'
});

function isEditableTarget(target) {
    if (!(target instanceof HTMLElement)) return false;

    return (
        target.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
    );
}

function getShortcutCandidates(event) {
    const candidates = new Set();
    const rawKey = String(event.key || '').trim().toUpperCase();
    if (rawKey) {
        candidates.add(rawKey);
    }

    const rawCode = String(event.code || '').trim();
    const codeMatch = rawCode.match(/^Key([A-Z])$/i);
    if (codeMatch) {
        candidates.add(codeMatch[1].toUpperCase());
    }

    return candidates;
}

const DICTATION_SCOPE_OPTIONS = [
    { key: 'new', label: '新词', note: '按录入日期', title: '新添加', emptyMessage: '没有新添加的单词' },
    { key: 'review', label: '常规', note: '按复习日期', title: '普通复习', emptyMessage: '没有普通复习单词' },
    { key: 'focus', label: '重点', note: '按复习日期', title: '重点巩固', emptyMessage: '没有重点巩固单词' }
];

const getRecordSortTimestamp = record => {
    const rawValue = record?.createdAt || record?.date || '';
    const timestamp = new Date(rawValue).getTime();
    return Number.isNaN(timestamp) ? 0 : timestamp;
};

const REVIEW_PROGRESS_FIELDS = [
    'reviewStage', 'nextReviewDate', 'sameDayReviewDate', 'sameDayReviewTarget',
    'sameDayReviewDone', 'forgetCount', 'hardCount', 'isFocusReview',
    'focusRecoveryStreak', 'focusLastReviewDate', 'mastered', 'masteredDate'
];

function restoreReviewProgress(latest, snapshot) {
    const restored = { ...latest };
    REVIEW_PROGRESS_FIELDS.forEach(field => { restored[field] = snapshot[field]; });
    return restored;
}

// --- 主应用逻辑 ---
export default function SmartVocabularyApp() {
    const [token, setToken] = useState(() => localStorage.getItem('auth_token'));
    const [currentUser, setCurrentUser] = useState(() => localStorage.getItem('auth_user'));
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [authEpoch, setAuthEpoch] = useState(0);
    const authEpochRef = useRef(0);
    const accountId = useMemo(() => getAccountId(token), [token]);

    // 核心数据
    const [records, setRecords] = useState([]);
    // view 状态增加 'writing'
    const [view, setView] = useState('input'); // input, review, list, frequency, date, article, writing
    const [reviewTab, setReviewTab] = useState('queue');
    const [filterLang, setFilterLang] = useState('all');
    const [listFilterStage, setListFilterStage] = useState('all');
    const [listFilterDate, setListFilterDate] = useState('all');
    const [listSearchQuery, setListSearchQuery] = useState('');

    const [isDataLoaded, setIsDataLoaded] = useState(false);
    const [dataStatus, setDataStatus] = useState('loading');
    const [recordCount, setRecordCount] = useState(null);
    const [dataError, setDataError] = useState('');
    const [saveStatus, setSaveStatus] = useState('saved');
    const [saveError, setSaveError] = useState('');
    const [pendingCount, setPendingCount] = useState(0);
    const [activeWriteCount, setActiveWriteCount] = useState(0);
    const [directWriteError, setDirectWriteError] = useState('');
    const [actionError, setActionError] = useState('');
    const effectiveSaveStatus = activeWriteCount > 0 ? 'saving' : directWriteError ? 'error' : saveStatus;
    const effectiveSaveError = directWriteError || saveError;
    const inputSaveStatus = activeWriteCount > 0 ? 'saving' : directWriteError ? 'error' : 'saved';
    const [conflictId, setConflictId] = useState(null);
    const [isBatchAnalyzing, setIsBatchAnalyzing] = useState(false);

    // 模态框
    const [showDictationModal, setShowDictationModal] = useState(false);
    const [dictationDate, setDictationDate] = useState(() => getTodayDateString());
    const [dictationScope, setDictationScope] = useState('new');
    const [modalRecord, setModalRecord] = useState(null);

    // 输入框
    const [inputDate, setInputDate] = useState(() => getCalendarDateString());
    const [inputWord, setInputWord] = useState('');
    const [inputSentence, setInputSentence] = useState('');
    const [inputMeaning, setInputMeaning] = useState('');
    const [latestLookupRecordId, setLatestLookupRecordId] = useState(null);
    const [lookupPanelState, setLookupPanelState] = useState({});

    // 复习
    const [reviewQueue, setReviewQueue] = useState([]); 
    const [reviewHistory, setReviewHistory] = useState([]); 
    const [isFlipped, setIsFlipped] = useState(false);
    const [reviewDate, setReviewDate] = useState(() => getTodayDateString());

    // AI & Settings
    const [showSettings, setShowSettings] = useState(false);
    const [settingsLoaded, setSettingsLoaded] = useState(false);
    const [settingsStatus, setSettingsStatus] = useState('loading');
    const [settingsError, setSettingsError] = useState('');
    const [settingsSaveStatus, setSettingsSaveStatus] = useState('saved');
    const [settingsSaveError, setSettingsSaveError] = useState('');
    const [settingsRetryVersion, setSettingsRetryVersion] = useState(0);
    const fileInputRef = useRef(null);
    const [settings, setSettings] = useState(() => readSettingsCache(getAccountId(localStorage.getItem('auth_token'))));
    const settingsDirtyRef = useRef(false);
    const settingsPatchRef = useRef({});
    const settingsSaveQueueRef = useRef(Promise.resolve());
    const settingsVersionRef = useRef(0);
    const settingsRetryDelayRef = useRef(2000);
    const settingsRequestAccountRef = useRef(null);
    const [settingsDirtyVersion, setSettingsDirtyVersion] = useState(0);
    const [apiKeyDraft, setApiKeyDraft] = useState('');
    const apiKeyDraftDirtyRef = useRef(false);
    const [apiKeySaveStatus, setApiKeySaveStatus] = useState('idle');
    const [apiKeySaveMessage, setApiKeySaveMessage] = useState('');
    const [isSavingApiKey, setIsSavingApiKey] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [adminStatusChecked, setAdminStatusChecked] = useState(false);
    const [inviteCodes, setInviteCodes] = useState([]);
    const [inviteCodesLoading, setInviteCodesLoading] = useState(false);
    const [inviteCodeError, setInviteCodeError] = useState('');
    const [inviteCodeDraft, setInviteCodeDraft] = useState({ code: '', maxUses: '1' });
    const [inviteCodeMutatingId, setInviteCodeMutatingId] = useState(null);
    const [isCreatingInviteCode, setIsCreatingInviteCode] = useState(false);
    const recordsRef = useRef([]);
    const recordSyncRef = useRef(null);
    const reviewActionPendingRef = useRef(false);
    const reviewResultHandlerRef = useRef(null);
    const { provider } = settings;
    const sessionIsCurrent = () => authEpochRef.current === authEpoch;

    // --- Auth Handlers ---
    const handleLogin = useCallback((newToken, username) => {
        authEpochRef.current += 1;
        setAuthEpoch(authEpochRef.current);
        recordSyncRef.current?.stop();
        recordSyncRef.current = null;
        recordsRef.current = [];
        setRecords([]);
        setRecordCount(null);
        setIsDataLoaded(false);
        setDataStatus('loading');
        setDirectWriteError('');
        setActionError('');
        setReviewQueue([]);
        setReviewHistory([]);
        setReviewTab('queue');
        setSettings(readSettingsCache(getAccountId(newToken)));
        apiKeyDraftDirtyRef.current = false;
        localStorage.setItem('auth_token', newToken);
        localStorage.setItem('auth_user', username);
        setToken(newToken);
        setCurrentUser(username);
    }, []);

    const handleLogout = useCallback(() => {
        authEpochRef.current += 1;
        setAuthEpoch(authEpochRef.current);
        recordSyncRef.current?.stop();
        recordSyncRef.current = null;
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        setToken(null);
        setCurrentUser(null);
        setRecords([]);
        setRecordCount(null);
        recordsRef.current = [];
        setIsDataLoaded(false);
        setDataStatus('idle');
        setDataError('');
        setReviewQueue([]);
        setReviewHistory([]);
        setReviewTab('queue');
        setIsFlipped(false);
        setModalRecord(null);
        setSaveStatus('saved');
        setSaveError('');
        setPendingCount(0);
        setActiveWriteCount(0);
        setDirectWriteError('');
        setActionError('');
        setConflictId(null);
        setSettings({ ...DEFAULT_APP_SETTINGS });
        settingsDirtyRef.current = false;
        settingsPatchRef.current = {};
        settingsSaveQueueRef.current = Promise.resolve();
        setApiKeyDraft('');
        apiKeyDraftDirtyRef.current = false;
        setApiKeySaveStatus('idle');
        setApiKeySaveMessage('');
        setIsSavingApiKey(false);
        setSettingsLoaded(false);
        setSettingsStatus('idle');
        setSettingsError('');
        setSettingsSaveStatus('saved');
        setSettingsSaveError('');
        settingsRequestAccountRef.current = null;
        setIsAdmin(false);
        setAdminStatusChecked(false);
        setInviteCodes([]);
        setInviteCodesLoading(false);
        setLatestLookupRecordId(null);
        setLookupPanelState({});
        setInviteCodeError('');
        setInviteCodeDraft({ code: '', maxUses: '1' });
        setInviteCodeMutatingId(null);
        setIsCreatingInviteCode(false);
    }, []);

    const fetchWithAuth = useCallback(async (url, options = {}) => {
        const headers = { ...options.headers, 'Authorization': `Bearer ${token}` };
        const res = await fetch(url, { ...options, headers });
        if (res.status === 401 && authEpochRef.current === authEpoch) {
            handleLogout();
            throw new Error("登录已过期，请重新登录");
        }
        return res;
    }, [authEpoch, handleLogout, token]);

    const handleUserLogout = async () => {
        if (isLoggingOut) return;
        setIsLoggingOut(true);
        try {
            const response = await fetch(`${API_BASE}/logout`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                signal: AbortSignal.timeout(5000)
            });
            if (!response.ok) throw new Error('服务端未确认注销');
        } catch {
            alert('当前设备已退出，但服务端未确认令牌注销；该令牌会在 7 天内自动过期。');
        } finally {
            handleLogout();
            setIsLoggingOut(false);
        }
    };

    const requestAiPrompt = useCallback((prompt, responseFormat = 'text') => {
        return requestAiCompletion(fetchWithAuth, { prompt, responseFormat });
    }, [fetchWithAuth]);

    // --- Init ---
    useEffect(() => {
        recordsRef.current = records;
    }, [records]);

    useEffect(() => {
        if (!isDataLoaded) return;
        setRecords(previous => previous.map(record => normalizeReviewRecord(record, reviewDate)));
        setReviewQueue(previous => previous.map(record => normalizeReviewRecord(record, reviewDate)));
    }, [isDataLoaded, reviewDate]);

    useEffect(() => {
        let resetTimeoutId;

        const refreshReviewDate = () => {
            setReviewDate(getTodayDateString());
            recordSyncRef.current?.retryIfNeeded();
        };

        const scheduleNextReset = () => {
            window.clearTimeout(resetTimeoutId);
            resetTimeoutId = window.setTimeout(() => {
                refreshReviewDate();
                scheduleNextReset();
            }, getMillisecondsUntilNextReviewReset() + 1000);
        };

        const handleVisibilityRefresh = () => {
            if (document.hidden) return;
            refreshReviewDate();
            scheduleNextReset();
        };

        refreshReviewDate();
        scheduleNextReset();
        window.addEventListener('focus', handleVisibilityRefresh);
        document.addEventListener('visibilitychange', handleVisibilityRefresh);

        return () => {
            window.clearTimeout(resetTimeoutId);
            window.removeEventListener('focus', handleVisibilityRefresh);
            document.removeEventListener('visibilitychange', handleVisibilityRefresh);
        };
    }, []);

    useEffect(() => {
        if (token && !accountId) handleLogout();
    }, [accountId, handleLogout, token]);

    useEffect(() => {
        if (!token || !accountId) return undefined;
        const epoch = authEpoch;
        const sync = new RecordSync({
            account: accountId,
            token,
            onRecords: nextRecords => {
                if (authEpochRef.current !== epoch) return;
                recordsRef.current = nextRecords;
                setRecords(nextRecords);
            },
            onRecordCount: count => {
                if (authEpochRef.current === epoch) setRecordCount(count);
            },
            onRemoteChanges: changedIds => {
                if (authEpochRef.current !== epoch) return;
                const changed = new Set(changedIds);
                setReviewHistory(previous => previous.filter(entry => !changed.has(entry.record.id)));
                setModalRecord(previous => previous && changed.has(previous.id) ? null : previous);
            },
            onDataStatus: (status, error = '') => {
                if (authEpochRef.current !== epoch) return;
                setDataStatus(status);
                setDataError(error);
                if (status === 'success' || status === 'cached' || status === 'partial') setIsDataLoaded(true);
            },
            onSaveStatus: ({ status, pendingCount: count, conflictId: id, error }) => {
                if (authEpochRef.current !== epoch) return;
                setSaveStatus(status);
                setPendingCount(count);
                setConflictId(id);
                setSaveError(error);
            },
            onUnauthorized: () => {
                if (authEpochRef.current === epoch) handleLogout();
            }
        });
        recordSyncRef.current = sync;
        const handleOnline = () => sync.retry();
        const handleFocus = () => sync.retryIfNeeded();
        window.addEventListener('online', handleOnline);
        window.addEventListener('focus', handleFocus);
        return () => {
            sync.stop();
            if (recordSyncRef.current === sync) recordSyncRef.current = null;
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('focus', handleFocus);
        };
    }, [accountId, authEpoch, handleLogout, token]);

    useEffect(() => {
        if (!token || !accountId) return undefined;
        let cancelled = false;
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 12000);
        if (settingsRequestAccountRef.current !== accountId) {
            settingsRequestAccountRef.current = accountId;
            settingsDirtyRef.current = false;
            settingsPatchRef.current = {};
            setSettings(readSettingsCache(accountId));
            setSettingsLoaded(false);
            setSettingsSaveStatus('saved');
            setSettingsSaveError('');
            settingsRetryDelayRef.current = 2000;
            apiKeyDraftDirtyRef.current = false;
        }
        setSettingsStatus('loading');
        setSettingsError('');
        const loadSettings = async () => {
            try {
                const response = await fetchWithAuth(`${API_BASE}/settings`, { signal: controller.signal });
                if (!response.ok) throw new Error('获取设置失败');
                const serverSettings = normalizeAppSettings(await response.json());
                if (cancelled) return;
                setSettings(normalizeAppSettings({ ...serverSettings, ...settingsPatchRef.current }));
                setSettingsStatus('success');
                if (!apiKeyDraftDirtyRef.current) {
                    setApiKeyDraft(serverSettings.apiKey || '');
                    setApiKeySaveStatus(serverSettings.apiKey ? 'saved' : 'idle');
                    setApiKeySaveMessage(serverSettings.apiKey ? '当前 API Key 已从服务端加载。' : '');
                }
                writeSettingsCache(accountId, serverSettings);
            } catch (error) {
                if (!cancelled) {
                    setSettingsStatus('error');
                    setSettingsError(error.name === 'AbortError' ? '设置请求超时' : error.message);
                }
            } finally {
                if (!cancelled) setSettingsLoaded(true);
                window.clearTimeout(timeoutId);
            }
        };
        void loadSettings();
        return () => {
            cancelled = true;
            controller.abort();
            window.clearTimeout(timeoutId);
        };
    }, [accountId, fetchWithAuth, settingsRetryVersion, token]);

    useEffect(() => {
        if (!token || !accountId || !settingsLoaded || !settingsDirtyRef.current) return undefined;
        const version = settingsVersionRef.current;
        const epoch = authEpoch;
        const patch = { ...settingsPatchRef.current };
        setSettingsSaveStatus('saving');
        const timeoutId = window.setTimeout(() => {
            settingsSaveQueueRef.current = settingsSaveQueueRef.current.catch(() => {}).then(async () => {
                const controller = new AbortController();
                const requestTimeoutId = window.setTimeout(() => controller.abort(), 12000);
                let response;
                try {
                    response = await fetchWithAuth(`${API_BASE}/settings`, {
                        method: 'POST',
                        signal: controller.signal,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(patch)
                    });
                } finally {
                    window.clearTimeout(requestTimeoutId);
                }
                if (!response.ok) throw new Error('保存设置失败');
                if (authEpochRef.current === epoch && version === settingsVersionRef.current) {
                    settingsDirtyRef.current = false;
                    settingsPatchRef.current = {};
                    setSettingsSaveStatus('saved');
                    setSettingsSaveError('');
                    writeSettingsCache(accountId, normalizeAppSettings({
                        ...readSettingsCache(accountId), ...patch
                    }));
                }
            }).catch(error => {
                if (authEpochRef.current !== epoch) return;
                setSettingsSaveStatus('error');
                setSettingsSaveError(error.name === 'AbortError' ? '设置保存超时，稍后会重试。' : error.message);
            });
        }, 400);
        return () => window.clearTimeout(timeoutId);
    }, [accountId, authEpoch, fetchWithAuth, settingsDirtyVersion, settingsLoaded, token]);

    useEffect(() => {
        const retrySettings = () => {
            if (settingsDirtyRef.current) setSettingsDirtyVersion(previous => previous + 1);
            if (settingsStatus === 'error') setSettingsRetryVersion(previous => previous + 1);
        };
        window.addEventListener('online', retrySettings);
        window.addEventListener('focus', retrySettings);
        return () => {
            window.removeEventListener('online', retrySettings);
            window.removeEventListener('focus', retrySettings);
        };
    }, [settingsStatus]);

    useEffect(() => {
        if (!token || !accountId) return undefined;
        if (settingsStatus !== 'error' && settingsSaveStatus !== 'error') {
            if (settingsStatus === 'success' && settingsSaveStatus === 'saved') {
                settingsRetryDelayRef.current = 2000;
            }
            return undefined;
        }
        const timeoutId = window.setTimeout(() => {
            if (settingsStatus === 'error') setSettingsRetryVersion(previous => previous + 1);
            if (settingsSaveStatus === 'error' && settingsDirtyRef.current) {
                setSettingsDirtyVersion(previous => previous + 1);
            }
        }, settingsRetryDelayRef.current);
        settingsRetryDelayRef.current = Math.min(settingsRetryDelayRef.current * 2, 30000);
        return () => window.clearTimeout(timeoutId);
    }, [accountId, settingsSaveStatus, settingsStatus, token]);

    const updateSetting = (key, val) => {
        const patch = key === 'provider'
            ? (() => {
                const preset = getAiProviderPreset(val);
                return { provider: val, dsBaseUrl: preset.baseUrl || '', dsModel: preset.model || settings.dsModel };
            })()
            : { [key]: val };
        settingsDirtyRef.current = true;
        setSettingsSaveStatus('saving');
        setSettingsSaveError('');
        settingsPatchRef.current = { ...settingsPatchRef.current, ...patch };
        settingsVersionRef.current += 1;
        setSettingsDirtyVersion(settingsVersionRef.current);
        setSettings(previous => ({ ...previous, ...patch }));
    };
    const retrySettings = () => {
        setSettingsRetryVersion(previous => previous + 1);
        if (settingsDirtyRef.current) setSettingsDirtyVersion(previous => previous + 1);
    };
    const updateInviteCodeDraft = (key, value) => setInviteCodeDraft(previous => ({ ...previous, [key]: value }));
    const updateApiKeyDraft = value => {
        apiKeyDraftDirtyRef.current = true;
        setApiKeyDraft(value);
        setApiKeySaveStatus('idle');
        setApiKeySaveMessage('');
    };

    const handleSaveApiKey = useCallback(async () => {
        const epoch = authEpoch;
        const trimmedApiKey = apiKeyDraft.trim();

        setIsSavingApiKey(true);
        setApiKeySaveStatus('idle');
        setApiKeySaveMessage('');

        try {
            const save = settingsSaveQueueRef.current.catch(() => {}).then(async () => {
                const controller = new AbortController();
                const timeoutId = window.setTimeout(() => controller.abort(), 12000);
                try {
                    return await fetchWithAuth(`${API_BASE}/settings/api-key`, {
                        method: 'POST',
                        signal: controller.signal,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ apiKey: trimmedApiKey })
                    });
                } finally {
                    window.clearTimeout(timeoutId);
                }
            });
            settingsSaveQueueRef.current = save.catch(() => {});
            const response = await save;
            if (authEpochRef.current !== epoch) return;

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || '保存 API Key 失败');
            }

            setSettings(previous => ({ ...previous, apiKey: trimmedApiKey }));
            setApiKeyDraft(trimmedApiKey);
            apiKeyDraftDirtyRef.current = false;
            setApiKeySaveStatus('saved');
            setApiKeySaveMessage(trimmedApiKey ? 'API Key 已保存到服务端。' : '服务端 API Key 已清空。');
        } catch (error) {
            if (authEpochRef.current !== epoch) return;
            console.error('保存 API Key 失败', error);
            setApiKeySaveStatus('error');
            setApiKeySaveMessage(error.message || '保存 API Key 失败');
        } finally {
            if (authEpochRef.current === epoch) setIsSavingApiKey(false);
        }
    }, [apiKeyDraft, authEpoch, fetchWithAuth]);

    const loadInviteCodes = useCallback(async () => {
        if (!token) return;

        setInviteCodesLoading(true);
        setInviteCodeError('');

        try {
            const response = await fetchWithAuth(`${API_BASE}/admin/invite-codes`);
            if (authEpochRef.current !== authEpoch) return;

            if (response.status === 403) {
                setIsAdmin(false);
                setAdminStatusChecked(true);
                setInviteCodes([]);
                return;
            }

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || '获取邀请码失败');
            }

            const data = await response.json();
            if (authEpochRef.current !== authEpoch) return;
            setIsAdmin(true);
            setAdminStatusChecked(true);
            setInviteCodes(Array.isArray(data) ? data : []);
        } catch (error) {
            if (authEpochRef.current !== authEpoch) return;
            console.error('获取邀请码失败', error);
            if (error.message !== '登录已过期，请重新登录') {
                setInviteCodeError(error.message || '获取邀请码失败');
                setAdminStatusChecked(true);
            }
        } finally {
            if (authEpochRef.current === authEpoch) setInviteCodesLoading(false);
        }
    }, [authEpoch, fetchWithAuth, token]);

    useEffect(() => {
        if (!token || !showSettings) return;
        loadInviteCodes();
    }, [loadInviteCodes, showSettings, token]);

    const handleCreateInviteCode = async () => {
        const normalizedCode = inviteCodeDraft.code.trim();
        const maxUses = Number.parseInt(inviteCodeDraft.maxUses, 10);

        if (!normalizedCode) {
            alert('请输入邀请码');
            return;
        }

        if (!Number.isInteger(maxUses) || maxUses <= 0) {
            alert('请输入有效的可用次数');
            return;
        }

        setIsCreatingInviteCode(true);
        setInviteCodeError('');

        try {
            const response = await fetchWithAuth(`${API_BASE}/admin/invite-codes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: normalizedCode, maxUses })
            });
            if (!sessionIsCurrent()) return;

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || '创建邀请码失败');
            }

            setInviteCodeDraft({ code: '', maxUses: '1' });
            await loadInviteCodes();
        } catch (error) {
            if (!sessionIsCurrent()) return;
            console.error('创建邀请码失败', error);
            setInviteCodeError(error.message || '创建邀请码失败');
        } finally {
            if (sessionIsCurrent()) setIsCreatingInviteCode(false);
        }
    };

    const handleToggleInviteCode = async inviteCode => {
        setInviteCodeMutatingId(inviteCode.id);
        setInviteCodeError('');

        try {
            const response = await fetchWithAuth(`${API_BASE}/admin/invite-codes/${inviteCode.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: !inviteCode.isActive })
            });
            if (!sessionIsCurrent()) return;

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || '更新邀请码失败');
            }

            await loadInviteCodes();
        } catch (error) {
            if (!sessionIsCurrent()) return;
            console.error('更新邀请码失败', error);
            setInviteCodeError(error.message || '更新邀请码失败');
        } finally {
            if (sessionIsCurrent()) setInviteCodeMutatingId(null);
        }
    };

    const handleDeleteInviteCode = async inviteCodeId => {
        if (!confirm('确定删除这个邀请码吗？')) return;

        setInviteCodeMutatingId(inviteCodeId);
        setInviteCodeError('');

        try {
            const response = await fetchWithAuth(`${API_BASE}/admin/invite-codes/${inviteCodeId}`, {
                method: 'DELETE'
            });
            if (!sessionIsCurrent()) return;

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || '删除邀请码失败');
            }

            await loadInviteCodes();
        } catch (error) {
            if (!sessionIsCurrent()) return;
            console.error('删除邀请码失败', error);
            setInviteCodeError(error.message || '删除邀请码失败');
        } finally {
            if (sessionIsCurrent()) setInviteCodeMutatingId(null);
        }
    };

    // --- CRUD Handlers (实时保存核心) ---

    const updateLookupState = useCallback((recordId, patch) => {
        setLookupPanelState(previous => {
            const current = previous[recordId] || {
                aiError: '',
                aiResult: null,
                aiStatus: 'idle',
                dictionaryError: '',
                dictionaryResult: null,
                dictionaryStatus: 'idle'
            };
            const nextPatch = typeof patch === 'function' ? patch(current) : patch;

            return {
                ...previous,
                [recordId]: {
                    ...current,
                    ...nextPatch
                }
            };
        });
    }, []);

    // 1. 增 (Create)
    const handleAddRecord = async (e) => {
        e.preventDefault();
        if (!sessionIsCurrent()) return;
        if (!inputWord) return;
        
        const payload = {
            creationSource: 'manual',
            date: inputDate,
            word: inputWord,
            sentence: inputSentence,
            customMeaning: inputMeaning
        };

        setActiveWriteCount(previous => previous + 1);
        try {
            const newRecord = await recordSyncRef.current.createRecord(payload);
            if (!sessionIsCurrent()) return;
            setLatestLookupRecordId(newRecord.id);
            setLookupPanelState(previous => ({
                ...previous,
                [newRecord.id]: createLookupPanelEntry(hasAiConfig(settings))
            }));
            
            // 清空输入
            setInputWord(''); setInputSentence(''); setInputMeaning('');
            void requestDictionaryForRecord(newRecord);
            if (hasAiConfig(settings)) {
                void callAIAnalysis(newRecord, { silent: true, updateLookupPanel: true });
            }
        } catch (err) {
            if (!sessionIsCurrent()) return;
            console.error(err);
            setDirectWriteError('添加结果未确认，请核对服务器记录。');
            alert("添加结果未确认，请先刷新核对再重试，避免重复添加");
        } finally {
            if (sessionIsCurrent()) setActiveWriteCount(previous => previous - 1);
        }
    };

    // 2. 改 (Update)
    const updateRecord = async (updatedRecord) => {
        if (!sessionIsCurrent()) return false;
        const sync = recordSyncRef.current;
        if (!sync) return false;
        try {
            const acceptedRecord = await sync.enqueueUpdate(updatedRecord);
            if (!sessionIsCurrent()) return false;
            setActionError('');
            setReviewQueue(prev => prev.map(r => r.id === acceptedRecord.id ? acceptedRecord : r));
            if (modalRecord && modalRecord.id === acceptedRecord.id) setModalRecord(acceptedRecord);
            return acceptedRecord;
        } catch (err) {
            if (!sessionIsCurrent()) return false;
            console.error("同步失败", err);
            setActionError(err.message);
            return false;
        }
    };

    // 3. 删 (Delete)
    const handleDelete = async (id) => {
        if (!sessionIsCurrent()) return;
        if (!confirm("删除?")) return;

        setActiveWriteCount(previous => previous + 1);
        try {
            await recordSyncRef.current.deleteRecord(id);
            if (!sessionIsCurrent()) return;
            if (latestLookupRecordId === id) setLatestLookupRecordId(null);
        } catch (error) {
            if (!sessionIsCurrent()) return;
            setDirectWriteError(`删除结果未确认：${error.message}`);
            alert(`删除未确认：${error.message}`);
        } finally {
            if (sessionIsCurrent()) setActiveWriteCount(previous => previous - 1);
        }
    };

    // 4. 批量添加 (Batch Add)
    const handleBatchAddRecords = async (newItems, creationSource = 'batch') => {
        if (!sessionIsCurrent()) return;
        setActiveWriteCount(previous => previous + 1);
        const today = getCalendarDateString();

        try {
            const sync = recordSyncRef.current;
            if (!sync) throw new Error('当前账户尚未准备好');
            const promises = newItems.map(item => sync.createRecord({
                creationSource,
                date: today,
                word: item.word,
                sentence: item.sentence || '',
                customMeaning: item.meaning || ''
            }));
            const results = await Promise.allSettled(promises);
            if (!sessionIsCurrent()) return;
            const savedCount = results.filter(result => result.status === 'fulfilled').length;
            const failedCount = results.length - savedCount;
            if (savedCount > 0) setView('list');
            if (failedCount > 0) {
                setDirectWriteError(`${failedCount} 条添加结果未确认`);
                alert(`已确认保存 ${savedCount} 条；另有 ${failedCount} 条结果未确认，请核对列表后再重试。`);
            } else {
                alert(`已成功添加 ${savedCount} 个单词到列表！`);
            }
        } catch (error) {
            if (!sessionIsCurrent()) return;
            setDirectWriteError(error.message);
            alert(error.message);
        } finally {
            if (sessionIsCurrent()) setActiveWriteCount(previous => previous - 1);
        }
    };

    // --- Logic Functions ---
    const detectLanguage = (analysis) => {
        if (!analysis) return 'other';
        if (analysis.includes('英语') || analysis.includes('English')) return 'en';
        if (analysis.includes('日语') || analysis.includes('Japanese') || analysis.includes('日本語')) return 'jp';
        return 'other';
    };

    const getNextReviewInterval = (stage, isReinforce) => {
        const standard = [1, 2, 4, 7, 15, 30, 60];
        const reinforce = [1, 1, 1, 1, 2, 1, 4, 4, 7, 8, 15, 15];
        const table = isReinforce ? reinforce : standard;
        return stage >= table.length ? null : table[stage];
    };

    const getQuestionType = (record) => {
        if (!record.needsReadingPractice) return 'C';
        const stage = record.reviewStage || 0;
        const cycle = Math.floor(stage / 3);
        const indexInCycle = stage % 3;
        const seed = record.id + cycle * 137;
        const permIndex = seed % 6;
        const permutations = [['A', 'B', 'C'], ['A', 'C', 'B'], ['B', 'A', 'C'], ['B', 'C', 'A'], ['C', 'A', 'B'], ['C', 'B', 'A']];
        return permutations[permIndex][indexInCycle];
    };

    const mainDueRecords = useMemo(() => {
        return records.filter(record => !record.mastered && !record.isFocusReview && record.nextReviewDate <= reviewDate);
    }, [records, reviewDate]);

    const focusDueRecords = useMemo(() => {
        return sortFocusRecords(records.filter(record => !record.mastered && record.isFocusReview && record.nextReviewDate <= reviewDate));
    }, [records, reviewDate]);

    const focusBoardRecords = useMemo(() => {
        return sortFocusRecords(records.filter(record => !record.mastered && record.isFocusReview));
    }, [records]);

    const recentManualEntries = useMemo(() => {
        return records
            .filter(record => (record.creationSource || 'manual') === 'manual')
            .sort((left, right) => {
                const timestampDiff = getRecordSortTimestamp(right) - getRecordSortTimestamp(left);
                return timestampDiff !== 0 ? timestampDiff : right.id - left.id;
            })
            .slice(0, 5);
    }, [records]);

    const latestLookupRecord = useMemo(() => {
        return records.find(record => record.id === latestLookupRecordId) || null;
    }, [latestLookupRecordId, records]);

    const latestLookupState = latestLookupRecordId
        ? lookupPanelState[latestLookupRecordId] || null
        : null;

    // --- Review Handlers ---
    useEffect(() => {
        if (!isDataLoaded) return;
        if (reviewTab === 'mastered') return;

        const candidates = reviewTab === 'focus' ? focusDueRecords : mainDueRecords;
        setReviewQueue(previousQueue => reconcileReviewQueue(previousQueue, candidates, {
            shuffleOnInit: reviewTab === 'queue'
        }));
    }, [focusDueRecords, isDataLoaded, mainDueRecords, reviewTab, view]);

    const currentReviewItem = reviewQueue[0];
    const currentQuestionType = currentReviewItem ? getQuestionType(currentReviewItem) : 'C';

    const handleReviewResult = async (quality) => {
        if (!currentReviewItem || reviewActionPendingRef.current) return;
        reviewActionPendingRef.current = true;
        const record = recordsRef.current.find(item => item.id === currentReviewItem.id) || currentReviewItem;
        const isReinforce = record.needsReadingPractice;
        const today = getTodayDateString();
        try {
            const performanceRecord = applyReviewPerformance(record, quality, today);
            let updatedRecord;
            let queueAction = 'remove';

            if (quality === 'forget' || quality === 'hard') {
                updatedRecord = startSameDayReview(performanceRecord, quality, today);
                queueAction = updatedRecord.isFocusReview && reviewTab !== 'focus' ? 'remove' : 'reinsert';
            } else if (isSameDayReviewActive(performanceRecord, today)) {
                const { completed, record: progressedRecord } = progressSameDayReview(performanceRecord, today);
                updatedRecord = completed ? maybeExitFocusReview(progressedRecord) : progressedRecord;
                queueAction = completed ? 'remove' : 'reinsert';
            } else {
                const interval = getNextReviewInterval(record.reviewStage, isReinforce);
                updatedRecord = interval === null
                    ? { ...clearFocusReviewFields(clearSameDayReviewFields(performanceRecord)), mastered: true, masteredDate: today }
                    : maybeExitFocusReview({
                        ...clearSameDayReviewFields(performanceRecord),
                        reviewStage: record.reviewStage + 1,
                        nextReviewDate: getFutureDateString(interval)
                    });
            }

            const acceptedRecord = await updateRecord(updatedRecord);
            if (!acceptedRecord) return;
            setReviewHistory(prev => [
                ...prev,
                {
                    queueTab: reviewTab,
                    queue: reviewQueue.map(item => JSON.parse(JSON.stringify(item))),
                    record: JSON.parse(JSON.stringify(record))
                }
            ]);
            setReviewQueue(prev => queueAction === 'reinsert'
                ? reinsertReviewItem(prev, acceptedRecord)
                : prev.slice(1).filter(item => item.id !== acceptedRecord.id));
            setIsFlipped(false);
        } finally {
            reviewActionPendingRef.current = false;
        }
    };

    const handleUndoReview = async () => {
        if (reviewHistory.length === 0 || reviewActionPendingRef.current) return;
        reviewActionPendingRef.current = true;
        const lastEntry = reviewHistory[reviewHistory.length - 1];
        try {
            const latest = recordsRef.current.find(item => item.id === lastEntry.record.id);
            if (!latest) return;
            const acceptedRecord = await updateRecord(restoreReviewProgress(latest, lastEntry.record));
            if (!acceptedRecord) return;
            setReviewTab(lastEntry.queueTab);
            setReviewQueue(lastEntry.queue.map(item => item.id === acceptedRecord.id ? acceptedRecord : item));
            setReviewHistory(prev => prev.slice(0, -1));
            setIsFlipped(false);
        } finally {
            reviewActionPendingRef.current = false;
        }
    };
    reviewResultHandlerRef.current = handleReviewResult;

    const handleMaster = async (id) => {
        const r = recordsRef.current.find(record => record.id === id);
        if (!r || !await updateRecord({
            ...clearFocusReviewFields(clearSameDayReviewFields(r)),
            mastered: true,
            masteredDate: getTodayDateString()
        })) return;
        setReviewQueue(prev => prev.filter(item => item.id !== id));
        setIsFlipped(false);
    };

    const handleResurrect = (id) => {
        const r = recordsRef.current.find(record => record.id === id);
        updateRecord({
            ...clearFocusReviewFields(clearSameDayReviewFields(r)),
            mastered: false,
            masteredDate: null,
            reviewStage: 0,
            nextReviewDate: getTodayDateString()
        });
    };

    const toggleReadingPractice = (id) => {
        const r = recordsRef.current.find(record => record.id === id);
        updateRecord({
            ...clearSameDayReviewFields(r),
            needsReadingPractice: !r.needsReadingPractice,
            reviewStage: 0,
            nextReviewDate: getTodayDateString()
        });
    };

    const extractReadingFromAnalysis = (text) => {
        if (!text) return '';
        const match = text.match(/(?:标音|读音|Reading|发音)[:：]\s*([^\n]+)/i);
        if (match) return match[1].trim();
        const kanaMatch = text.match(/[\u3040-\u309F\u30A0-\u30FF]+/);
        return kanaMatch ? kanaMatch[0] : '';
    };

    const requestDictionaryForRecord = async (record) => {
        if (!sessionIsCurrent()) return;
        updateLookupState(record.id, {
            dictionaryError: '',
            dictionaryStatus: 'loading'
        });

        try {
            const dictionaryResult = await requestDictionaryLookup(fetchWithAuth, {
                sentence: record.sentence,
                word: record.word
            });
            if (!sessionIsCurrent()) return;

            updateLookupState(record.id, {
                dictionaryError: '',
                dictionaryResult,
                dictionaryStatus: 'success'
            });

            const currentRecord = recordsRef.current.find(item => item.id === record.id);
            if (currentRecord) {
                const nextDictionaryMeaning = dictionaryResult.definitions?.[0] || currentRecord.dictionaryMeaning || '';
                const nextReading = currentRecord.reading || dictionaryResult.reading || '';
                const shouldPersistDictionaryData =
                    nextDictionaryMeaning !== (currentRecord.dictionaryMeaning || '') ||
                    nextReading !== (currentRecord.reading || '');

                if (shouldPersistDictionaryData) {
                    updateRecord({
                        ...currentRecord,
                        dictionaryMeaning: nextDictionaryMeaning,
                        reading: nextReading
                    });
                }
            }
        } catch (error) {
            if (!sessionIsCurrent()) return;
            console.error(error);
            updateLookupState(record.id, {
                dictionaryError: error.message || '词典请求失败',
                dictionaryStatus: 'error'
            });
        }
    };

    const callAIAnalysis = async (record, options = {}) => {
        if (!sessionIsCurrent()) return;
        const { silent = false, updateLookupPanel = false } = options;
        if (!hasAiConfig(settings)) {
            if (updateLookupPanel) {
                updateLookupState(record.id, {
                    aiError: '未配置 AI，可稍后在词条详情中手动生成。',
                    aiStatus: 'idle'
                });
            }
            if (!silent) alert("请配置 API Key");
            return;
        }

        if (updateLookupPanel) {
            updateLookupState(record.id, {
                aiError: '',
                aiResult: null,
                aiStatus: 'loading'
            });
        }

        const promptText = `我正在学习单词。单词：${record.word}。${record.sentence ? '句子：' + record.sentence : '请根据单词造句并解析'}。${record.customMeaning ? '用户备注含义：' + record.customMeaning : ''}。请严格按照以下 Markdown 格式解析，并保持编号顺序不变：1. **常见解释**: (用中文写一个最常见、最口语、10字以内的简短解释) 2. **语言识别**: (英语/日语) 3. **标音**: (日语提供假名，英语提供音标) 4. **确切含义**: (解释更准确的含义) 5. **语法分析**: (简要说明) 6. **固定搭配**: (列出3个) 请保持简洁。`;
        try {
            const aiContent = await requestAiPrompt(promptText);
            if (!sessionIsCurrent()) return;
            const reading = extractReadingFromAnalysis(aiContent);
            const currentRecord = recordsRef.current.find(item => item.id === record.id);

            if (currentRecord) {
                updateRecord({
                    ...currentRecord,
                    aiAnalysis: aiContent,
                    reading: currentRecord.reading || reading
                });
            }

            if (updateLookupPanel) {
                updateLookupState(record.id, {
                    aiError: '',
                    aiResult: { content: aiContent, reading },
                    aiStatus: 'success'
                });
            }
        } catch (e) {
            if (!sessionIsCurrent()) return;
            console.error(e);
            if (updateLookupPanel) {
                updateLookupState(record.id, {
                    aiError: e.message || 'AI 请求失败',
                    aiStatus: 'error'
                });
            }
            if (!silent) alert(e.message);
        }
    };

    const handleBatchAnalyze = async () => {
        if (dataStatus !== 'success' && dataStatus !== 'cached') return alert('请等待完整单词数据加载后再批量解析。');
        if (!hasAiConfig(settings)) return setShowSettings(true);
        const pending = records.filter(r => !r.aiAnalysis);
        if (pending.length === 0) return alert("没有需要解析的单词");
        if (!confirm(`即将解析 ${pending.length} 个单词，请勿关闭页面。`)) return;
        setIsBatchAnalyzing(true);
        for (const r of pending) { await callAIAnalysis(r, { silent: true }); await new Promise(res => setTimeout(res, 800)); }
        setIsBatchAnalyzing(false); alert("批量解析完成");
    };

    useEffect(() => {
        if (view !== 'review') return undefined;

        const onKeyDown = event => {
            const shortcutMap = {
                [settings.reviewShortcutForget]: () => {
                    if (reviewTab !== 'mastered' && currentReviewItem && isFlipped) {
                        reviewResultHandlerRef.current?.('forget');
                    }
                },
                [settings.reviewShortcutHard]: () => {
                    if (reviewTab !== 'mastered' && currentReviewItem && isFlipped) {
                        reviewResultHandlerRef.current?.('hard');
                    }
                },
                [settings.reviewShortcutEasy]: () => {
                    if (reviewTab !== 'mastered' && currentReviewItem && isFlipped) {
                        reviewResultHandlerRef.current?.('easy');
                    }
                }
            };

            const pressedKeys = getShortcutCandidates(event);
            const matchedAction = Array.from(pressedKeys)
                .map(key => shortcutMap[key])
                .find(Boolean);

            if (!matchedAction) return;
            if (event.repeat) return;
            if (showSettings || showDictationModal || modalRecord) return;
            if (isEditableTarget(event.target)) return;

            event.preventDefault();
            matchedAction();
        };

        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
    }, [
        currentReviewItem,
        isFlipped,
        modalRecord,
        reviewTab,
        settings.reviewShortcutEasy,
        settings.reviewShortcutForget,
        settings.reviewShortcutHard,
        showDictationModal,
        showSettings,
        view
    ]);

    const playTTS = (text) => { if ('speechSynthesis' in window) { const u = new SpeechSynthesisUtterance(text); if (text.match(/[\u3040-\u309F\u30A0-\u30FF]/)) u.lang = 'ja-JP'; window.speechSynthesis.speak(u); } };

    const handleImportClick = async () => {
        try {
            await loadXlsxLibrary();
            fileInputRef.current?.click();
        } catch (error) {
            alert(error.message);
        }
    };
    const handleFileChange = (e) => {
        const file = e.target.files[0]; if (!file || !window.XLSX) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const wb = window.XLSX.read(evt.target.result, { type: 'binary' });
                const data = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
                
                // 将读取到的数据格式化为待上传数组
                const itemsToAdd = [];
                data.forEach((row) => {
                    const word = row['单词'] || row['Word'] || row['word'];
                    if (!word) return;
                    const sentence = row['句子'] || row['Sentence'] || row['sentence'] || '';
                    const customMeaning = row['中文释义'] || row['释义'] || row['Meaning'] || row['Definition'] || '';
                    itemsToAdd.push({ word: String(word).trim(), sentence: String(sentence).trim(), meaning: String(customMeaning).trim() });
                });

                if (itemsToAdd.length > 0) {
                     handleBatchAddRecords(itemsToAdd, 'import'); // 使用批量添加接口
                } else { alert("Excel 没找到有效数据 (需包含'单词'列)"); }
            } catch (error) {
                console.error(error);
                alert("导入失败");
            }
        };
        reader.readAsBinaryString(file); e.target.value = '';
    };

    // --- Filtering & Export ---
    const filteredRecords = useMemo(() => {
        let res = records;
        if (filterLang !== 'all') res = res.filter(record => detectLanguage(record.aiAnalysis) === filterLang);
        if (listFilterStage !== 'all') {
            if (listFilterStage === 'mastered') res = res.filter(r => r.mastered);
            else {
                 const stageNum = parseInt(listFilterStage);
                 if (!isNaN(stageNum)) res = res.filter(r => !r.mastered && r.reviewStage === stageNum);
            }
        }
        if (listFilterDate !== 'all') {
            if (listFilterDate === 'overdue') res = res.filter(r => !r.mastered && r.nextReviewDate < reviewDate);
            else if (listFilterDate === 'today') res = res.filter(r => !r.mastered && r.nextReviewDate === reviewDate);
            else if (listFilterDate === 'tomorrow') {
                const tmrStr = getFutureDateString(1);
                res = res.filter(r => !r.mastered && r.nextReviewDate === tmrStr);
            }
            else if (listFilterDate === 'future') res = res.filter(r => !r.mastered && r.nextReviewDate > reviewDate);
        }
        return res;
    }, [records, filterLang, listFilterStage, listFilterDate, reviewDate]);

    const listViewRecords = useMemo(() => {
        const keyword = listSearchQuery.trim().toLowerCase();
        if (!keyword) {
            return filteredRecords;
        }

        return filteredRecords.filter(record => {
            const fields = [
                record.word,
                record.reading,
                record.customMeaning,
                record.dictionaryMeaning,
                record.sentence,
                record.aiAnalysis
            ];

            return fields.some(field => String(field || '').toLowerCase().includes(keyword));
        });
    }, [filteredRecords, listSearchQuery]);

    const frequencyData = useMemo(() => {
        const map = {};
        filteredRecords.forEach(record => {
            const w = record.word.toLowerCase();
            if (!map[w]) map[w] = { word: record.word, count: 0, ids: [], details: {} };
            map[w].count += 1; map[w].ids.push(record.id); map[w].details[record.id] = record;
        });
        return Object.values(map).sort((a, b) => b.count - a.count);
    }, [filteredRecords]);

    const dateGroupedData = useMemo(() => {
        const map = {};
        filteredRecords.forEach(record => { if (!map[record.date]) map[record.date] = []; map[record.date].push(record); });
        return Object.entries(map).sort((a, b) => new Date(b[0]) - new Date(a[0])).map(([date, items]) => ({ date, items: items.sort((a, b) => b.id - a.id) }));
    }, [filteredRecords]);

    const cleanMarkdownForExcel = (text) => text ? text.replace(/\*\*/g, '').replace(/^(\d+\.|-)\s/gm, '• ').replace(/\n\n/g, '\n') : '';

    const exportFrequencyExcel = async () => {
        try { await loadXlsxLibrary(); } catch (error) { return alert(error.message); }
        const dataToExport = frequencyData.map(item => ({ "单词": item.word, "出现次数": item.count }));
        const ws = window.XLSX.utils.json_to_sheet(dataToExport);
        const wb = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(wb, ws, "词频统计");
        window.XLSX.writeFile(wb, `词频统计_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    const exportDateArchiveExcel = async () => {
        try { await loadXlsxLibrary(); } catch (error) { return alert(error.message); }
        const rows = [];
        dateGroupedData.forEach(group => {
            rows.push([group.date]);
            rows.push(["单词", "句子", "手动释义", "AI深度解析", "读音"]);
            group.items.forEach(item => {
                rows.push([
                    item.word,
                    item.sentence,
                    item.customMeaning || '',
                    cleanMarkdownForExcel(item.aiAnalysis),
                    item.reading || ''
                ]);
            });
            rows.push([]);
        });
        const ws = window.XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [{ wch: 15 }, { wch: 40 }, { wch: 25 }, { wch: 50 }, { wch: 15 }];
        const wb = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(wb, ws, "日期归档");
        window.XLSX.writeFile(wb, `单词归档_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    const extractMeaning = (text) => { if (!text) return ''; const match = text.match(/(?:\*\*)?(?:常见解释|短释义|确切含义|含义|Meaning)(?:\*\*)?[:：]\s*([^\n]+)/i); if (match) return match[1].trim(); return text.slice(0, 30).replace(/\*\*/g, '') + '...'; };

    const generateDictationSheet = () => {
        const selectedScope = DICTATION_SCOPE_OPTIONS.find(option => option.key === dictationScope) || DICTATION_SCOPE_OPTIONS[0];
        const targetRecords = records.filter(record => {
            if (dictationScope === 'focus') {
                return !record.mastered && record.isFocusReview && record.nextReviewDate === dictationDate;
            }

            if (dictationScope === 'review') {
                return !record.mastered && !record.isFocusReview && record.nextReviewDate === dictationDate;
            }

            return record.date === dictationDate;
        });

        if (targetRecords.length === 0) return alert(`${dictationDate} ${selectedScope.emptyMessage}`);
        let questions = [];
        targetRecords.forEach(r => {
            const answer = r.customMeaning || extractMeaning(r.aiAnalysis) || "暂无释义";
            questions.push({ type: 'word', content: r.word, answer: answer, id: r.id });
            if (r.needsReadingPractice && r.reading) {
                questions.push({ type: 'reading', content: `${r.reading} (听音/读音)`, answer: `${answer} [对应单词: ${r.word}]`, id: r.id + '_reading' });
            }
        });
        questions = shuffleArray(questions);
        const printWindow = window.open('', '_blank');
        if (!printWindow) return alert("请允许弹窗");
        printWindow.opener = null;

        const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>听写测试 - ${escapeHtml(selectedScope.title)} - ${escapeHtml(dictationDate)}</title>
          <style>
            body { font-family: 'Segoe UI', sans-serif; padding: 40px; max-width: 210mm; margin: 0 auto; color: #333; }
            h1 { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; }
            .meta { text-align: center; color: #666; margin-bottom: 30px; font-size: 0.9em; }
            .question-row { display: flex; border-bottom: 1px solid #eee; padding: 12px 0; align-items: baseline; }
            .q-num { width: 30px; color: #999; font-weight: bold; flex-shrink: 0; }
            .q-content { width: 35%; font-size: 1.2em; font-weight: bold; color: #000; word-break: break-all; }
            .q-space { flex: 1; border-bottom: 1px dashed #ccc; margin: 0 15px; height: 1.5em; }
            .q-answer { font-size: 0.9em; color: #666; }
            .list-key { display: none; }
            body.mode-1 .list-main .q-answer { display: none; }
            body.mode-1 .list-key { display: block; page-break-before: always; }
            body.mode-1 .list-key .q-answer { display: block; width: 50%; text-align: left; }
            body.mode-1 .list-key .q-space { display: none; }
            body.mode-2 .list-key { display: none; }
            body.mode-2 .list-main .q-answer { display: block; width: 30%; text-align: right; transform: rotate(180deg); color: #999; }
            body.mode-3 .list-key { display: none; }
            body.mode-3 .list-main .q-answer { display: block; width: 35%; text-align: left; border-left: 2px solid #eee; padding-left: 15px; color: #333; }
            .controls { position: fixed; top: 20px; right: 20px; background: white; padding: 15px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border: 1px solid #eee; display: flex; flex-direction: column; gap: 8px; z-index: 999; }
            button { background: #f3f4f6; border: 1px solid #ddd; padding: 8px; border-radius: 4px; cursor: pointer; text-align: left; font-size: 13px; }
            button.active { background: #e0e7ff; color: #4338ca; border-color: #c7d2fe; font-weight: bold; }
            button.primary { background: #4f46e5; color: white; text-align: center; border: none; font-size: 14px; margin-top: 5px;}
            @media print { .controls { display: none !important; } body { padding: 0; margin: 20mm; } }
          </style>
        </head>
        <body class="mode-1">
          <div class="controls">
            <div style="display:flex;flex-direction:column;gap:5px">
                <button onclick="setMode(1)" id="btn-m1" class="active">📄 方案1：试卷分离 (推荐)</button>
                <button onclick="setMode(2)" id="btn-m2">🙃 方案2：答案倒置</button>
                <button onclick="setMode(3)" id="btn-m3">📑 方案3：右侧答案栏</button>
            </div>
            <button class="primary" onclick="window.print()">🖨️ 打印 / PDF</button>
          </div>
          <div class="list-main">
              <h1>听写测试 <span style="font-size:0.6em; font-weight:normal; color:#666">(试卷)</span></h1>
              <div class="meta">类型: ${escapeHtml(selectedScope.title)} | 日期: ${escapeHtml(dictationDate)} | 题数: ${questions.length}</div>
              ${questions.map((q, i) => `
                <div class="question-row">
                  <span class="q-num">${i + 1}.</span>
                  <span class="q-content">${escapeHtml(q.content)}</span>
                  <span class="q-space"></span>
                  <span class="q-answer">${escapeHtml(q.answer)}</span>
                </div>
              `).join('')}
          </div>
          <div class="list-key">
              <h1>听写测试 <span style="font-size:0.6em; font-weight:normal; color:#666">(答案卷)</span></h1>
              <div class="meta">核对区 | ${escapeHtml(selectedScope.title)}</div>
              ${questions.map((q, i) => `
                <div class="question-row">
                  <span class="q-num">${i + 1}.</span>
                  <span class="q-content">${escapeHtml(q.content)}</span>
                  <span class="q-space" style="visibility:hidden"></span>
                  <span class="q-answer">${escapeHtml(q.answer)}</span>
                </div>
              `).join('')}
          </div>
          <script>
            function setMode(m){
              document.body.className='mode-'+m;
              document.querySelectorAll('button').forEach(b=>b.classList.remove('active'));
              document.getElementById('btn-m'+m).classList.add('active');
            }
          </script>
        </body>
      </html>
    `;
        printWindow.document.open(); printWindow.document.write(htmlContent); printWindow.document.close();
    };

    // 如果未登录，显示登录页
    if (!token) {
        return <AuthScreen onLogin={handleLogin} />;
    }

    // 主界面 - 增加 pb-[env(safe-area-inset-bottom)] 适配 iPhone 底部
    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-[env(safe-area-inset-bottom)]">
            <AppHeader
                adminStatusChecked={adminStatusChecked}
                apiKeyDraft={apiKeyDraft}
                apiKeySaveMessage={apiKeySaveMessage}
                apiKeySaveStatus={apiKeySaveStatus}
                currentUser={currentUser}
                fileInputRef={fileInputRef}
                handleBatchAnalyze={handleBatchAnalyze}
                handleFileChange={handleFileChange}
                handleImportClick={handleImportClick}
                handleLogout={handleUserLogout}
                inviteCodeDraft={inviteCodeDraft}
                inviteCodeError={inviteCodeError}
                inviteCodeMutatingId={inviteCodeMutatingId}
                inviteCodes={inviteCodes}
                inviteCodesLoading={inviteCodesLoading}
                isAdmin={isAdmin}
                isCreatingInviteCode={isCreatingInviteCode}
                isBatchAnalyzing={isBatchAnalyzing}
                isSavingApiKey={isSavingApiKey}
                isLoggingOut={isLoggingOut}
                onCreateInviteCode={handleCreateInviteCode}
                onDeleteInviteCode={handleDeleteInviteCode}
                onRefreshInviteCodes={loadInviteCodes}
                onSaveApiKey={handleSaveApiKey}
                onSetView={setView}
                onToggleInviteCode={handleToggleInviteCode}
                onToggleSettings={() => setShowSettings(previous => !previous)}
                onUpdateApiKeyDraft={updateApiKeyDraft}
                onUpdateInviteCodeDraft={updateInviteCodeDraft}
                onUpdateSetting={updateSetting}
                settingsStatus={settingsStatus}
                settingsError={settingsError}
                settingsSaveStatus={settingsSaveStatus}
                settingsSaveError={settingsSaveError}
                onRetrySettings={retrySettings}
                provider={provider}
                recordsCount={recordCount}
                dataStatus={dataStatus}
                pendingCount={pendingCount}
                saveError={effectiveSaveError}
                activeWriteCount={activeWriteCount}
                reviewShortcutEasy={settings.reviewShortcutEasy}
                reviewShortcutForget={settings.reviewShortcutForget}
                reviewShortcutHard={settings.reviewShortcutHard}
                reviewQueueLength={mainDueRecords.length + focusDueRecords.length}
                saveStatus={effectiveSaveStatus}
                showSettings={showSettings}
                showReviewSentence={settings.showReviewSentence}
                view={view}
            />

            <main className="max-w-5xl mx-auto p-4 md:p-6 pb-20">
                {(dataStatus === 'cached' || dataStatus === 'partial' || dataStatus === 'error' || effectiveSaveStatus === 'error' || effectiveSaveStatus === 'conflict' || actionError) && (
                    <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="status">
                        <div>{dataStatus === 'cached' ? '正在使用本地数据，服务器核对尚未完成。' : dataStatus === 'partial' ? `复习数据已就绪，完整单词列表仍在加载。${dataError ? `加载失败：${dataError}` : ''}` : dataStatus === 'error' ? `单词加载失败：${dataError}` : ''}</div>
                        {effectiveSaveError && <div>{effectiveSaveError}</div>}
                        {actionError && <div>{actionError} <button type="button" onClick={() => setActionError('')} className="underline">关闭提示</button></div>}
                        {directWriteError && (
                            <button type="button" onClick={() => setDirectWriteError('')} className="mt-1 underline">已核对服务器记录，关闭提示</button>
                        )}
                        {pendingCount > 0 && <div>还有 {pendingCount} 次操作未获服务器确认；显示「已保存」前请勿清除浏览器数据。</div>}
                        <div className="mt-2 flex flex-wrap gap-2">
                            <button type="button" onClick={() => recordSyncRef.current?.retry()} className="rounded bg-amber-200 px-3 py-1">重新连接</button>
                            {conflictId && (
                                <>
                                    <button type="button" onClick={() => recordSyncRef.current?.resolveConflict(true)} className="rounded bg-amber-200 px-3 py-1">用本地进度覆盖服务器</button>
                                    <button type="button" onClick={() => recordSyncRef.current?.resolveConflict(false)} className="rounded border border-amber-400 px-3 py-1">放弃本地进度，使用服务器</button>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {view === 'writing' && (
                    <WritingPolisher 
                        settings={settings}
                        requestAiPrompt={requestAiPrompt}
                        onAddWords={items => handleBatchAddRecords(items, 'writing')}
                        onCancel={() => setView('input')}
                    />
                )}

                {view === 'article' && (
                    <ArticleAnalyzer 
                        settings={settings}
                        requestAiPrompt={requestAiPrompt}
                        onAddWords={items => handleBatchAddRecords(items, 'article')}
                        onCancel={() => setView('input')}
                    />
                )}

                {view === 'input' && (
                    <InputView
                        inputDate={inputDate}
                        inputMeaning={inputMeaning}
                        inputSentence={inputSentence}
                        inputWord={inputWord}
                        latestLookupRecord={latestLookupRecord}
                        latestLookupState={latestLookupState}
                        lookupPanelState={lookupPanelState}
                        onInputDateChange={setInputDate}
                        onInputMeaningChange={setInputMeaning}
                        onInputSentenceChange={setInputSentence}
                        onInputWordChange={setInputWord}
                        onSubmit={handleAddRecord}
                        recentManualEntries={recentManualEntries}
                        saveStatus={inputSaveStatus}
                    />
                )}

                {view === 'review' && !isDataLoaded && (
                    <div className="rounded-xl bg-white p-8 text-center" role="status">
                        {dataStatus === 'error' ? '单词加载失败，请重新连接后再复习。' : '正在加载单词与复习队列…'}
                    </div>
                )}
                {view === 'review' && isDataLoaded && (
                    <ReviewView
                        currentQuestionType={currentQuestionType}
                        currentReviewItem={currentReviewItem}
                        focusBoardRecords={focusBoardRecords}
                        focusQueueCount={focusDueRecords.length}
                        handleMaster={handleMaster}
                        handleReviewResult={handleReviewResult}
                        handleUndoReview={handleUndoReview}
                        isFlipped={isFlipped}
                        isPartial={dataStatus === 'partial'}
                        mainQueueCount={mainDueRecords.length}
                        onResurrect={handleResurrect}
                        playTTS={playTTS}
                        records={records}
                        reviewHistory={reviewHistory}
                        reviewQueue={reviewQueue}
                        reviewTab={reviewTab}
                        showReviewSentence={settings.showReviewSentence}
                        setIsFlipped={setIsFlipped}
                        setReviewTab={setReviewTab}
                        updateRecord={updateRecord}
                    />
                )}

                {['list', 'frequency', 'date'].includes(view) && (!isDataLoaded || dataStatus === 'partial') && (
                    <div className="rounded-xl bg-white p-8 text-center" role="status">
                        {dataStatus === 'error' ? '完整单词列表加载失败，请重新连接。' : '完整单词列表加载完成后即可查看此页面。'}
                    </div>
                )}

                {view === 'list' && isDataLoaded && dataStatus !== 'partial' && (
                    <ListView
                        filteredRecords={listViewRecords}
                        listFilterDate={listFilterDate}
                        listSearchQuery={listSearchQuery}
                        listFilterStage={listFilterStage}
                        onDelete={handleDelete}
                        onOpenModal={setModalRecord}
                        onSetListFilterDate={setListFilterDate}
                        onSetListSearchQuery={setListSearchQuery}
                        onSetListFilterStage={setListFilterStage}
                        onToggleReadingPractice={toggleReadingPractice}
                    />
                )}

                {view === 'frequency' && isDataLoaded && dataStatus !== 'partial' && (
                    <FrequencyView
                        filterLang={filterLang}
                        frequencyData={frequencyData}
                        onExportFrequencyExcel={exportFrequencyExcel}
                        onOpenModal={setModalRecord}
                        onSetFilterLang={setFilterLang}
                    />
                )}

                {view === 'date' && isDataLoaded && dataStatus !== 'partial' && (
                    <DateArchiveView
                        dateGroupedData={dateGroupedData}
                        filterLang={filterLang}
                        onDelete={handleDelete}
                        onExportDateArchiveExcel={exportDateArchiveExcel}
                        onOpenModal={setModalRecord}
                        onSetFilterLang={setFilterLang}
                        onShowDictationModal={() => setShowDictationModal(true)}
                    />
                )}
            </main>

            {/* Modal 弹窗 - 提升 z-index 到 100 以确保在 header 之上 */}
            {modalRecord && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b flex justify-between bg-slate-50/50"><div><h3 className="text-3xl font-extrabold text-slate-800">{modalRecord.word}</h3></div><button onClick={() => setModalRecord(null)}><X className="w-6 h-6 text-slate-400" /></button></div>
                        <div className="p-6 overflow-y-auto custom-scrollbar">
                            <div className="bg-slate-50 p-4 rounded-xl border mb-6 relative"><span className="absolute top-2 left-2 text-4xl text-indigo-100 font-serif leading-none">“</span><p className="text-lg font-serif text-slate-700 relative z-10 px-4">{modalRecord.sentence || "暂无例句"}</p></div>
                            <MeaningSection key={`${modalRecord.id}:${modalRecord.revision}:${modalRecord.clientMutationId || ''}`} record={modalRecord} onUpdate={updateRecord} />
                            <div className="mt-6 flex justify-end">
                                {!modalRecord.aiAnalysis && (
                                    <button onClick={() => callAIAnalysis(modalRecord)} className="text-sm text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded hover:bg-indigo-50 flex items-center gap-1"><Sparkles className="w-3 h-3" /> 生成 AI 解析</button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 听写纸模态框 - z-index 100 */}
            {showDictationModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
                        <h3 className="text-xl font-bold text-slate-800 mb-4">生成听写测试</h3>
                        <p className="text-sm text-slate-500 mb-4">请选择日期：</p>
                        <input type="date" value={dictationDate} onChange={e => setDictationDate(e.target.value)} className="w-full p-3 bg-slate-50 border rounded-xl mb-6 outline-none focus:ring-2 ring-indigo-500 text-base" />
                        <div className="grid grid-cols-3 gap-2 mb-6">
                            {DICTATION_SCOPE_OPTIONS.map(option => {
                                const active = dictationScope === option.key;
                                return (
                                    <button
                                        key={option.key}
                                        onClick={() => setDictationScope(option.key)}
                                        className={`rounded-xl border px-3 py-3 text-left transition ${active ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                                    >
                                        <div className="text-sm font-bold">{option.label}</div>
                                        <div className="text-[11px] mt-1 opacity-80">{option.note}</div>
                                    </button>
                                );
                            })}
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setShowDictationModal(false)} className="flex-1 py-2 rounded-lg bg-slate-100 text-slate-600 font-medium">取消</button>
                            <button onClick={() => { generateDictationSheet(); setShowDictationModal(false); }} className="flex-1 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700">生成试卷</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
