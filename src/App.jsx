import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    BookOpen, Calendar, BarChart2, Trash2, X,
    Sparkles, BrainCircuit, FileSpreadsheet, Filter,
    Printer, Trophy, Zap
} from 'lucide-react';
import { requestAiCompletion } from './client/aiApi.js';
import { requestDictionaryLookup } from './client/dictionaryApi.js';
import { DEFAULT_APP_SETTINGS, hasAiConfig, normalizeAppSettings } from './client/defaultSettings.js';
import {
    applyReviewPerformance,
    getCalendarDateString,
    getFutureDateString,
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
import { loadXlsxLibrary } from './client/xlsxLoader.js';
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

// --- 主应用逻辑 ---
export default function SmartVocabularyApp() {
    const [token, setToken] = useState(() => localStorage.getItem('auth_token'));
    const [currentUser, setCurrentUser] = useState(() => localStorage.getItem('auth_user'));

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
    const [saveStatus, setSaveStatus] = useState('saved');
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

    // AI & Settings
    const [showSettings, setShowSettings] = useState(false);
    const [settingsLoaded, setSettingsLoaded] = useState(false);
    const fileInputRef = useRef(null);
    const [settings, setSettings] = useState(() => readSettingsCache());
    const [apiKeyDraft, setApiKeyDraft] = useState('');
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
    const reviewResultHandlerRef = useRef(null);
    const { provider } = settings;
    const publicSettings = useMemo(() => ({
        provider: settings.provider,
        dsBaseUrl: settings.dsBaseUrl,
        dsModel: settings.dsModel,
        reviewShortcutEasy: settings.reviewShortcutEasy,
        reviewShortcutForget: settings.reviewShortcutForget,
        reviewShortcutHard: settings.reviewShortcutHard,
        showReviewSentence: settings.showReviewSentence
    }), [
        settings.dsBaseUrl,
        settings.dsModel,
        settings.provider,
        settings.reviewShortcutEasy,
        settings.reviewShortcutForget,
        settings.reviewShortcutHard,
        settings.showReviewSentence
    ]);

    // --- Auth Handlers ---
    const handleLogin = useCallback((newToken, username) => {
        localStorage.setItem('auth_token', newToken);
        localStorage.setItem('auth_user', username);
        setToken(newToken);
        setCurrentUser(username);
    }, []);

    const handleLogout = useCallback(() => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        setToken(null);
        setCurrentUser(null);
        setRecords([]);
        setIsDataLoaded(false);
        setSettings({ ...DEFAULT_APP_SETTINGS });
        setApiKeyDraft('');
        setApiKeySaveStatus('idle');
        setApiKeySaveMessage('');
        setIsSavingApiKey(false);
        setSettingsLoaded(false);
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
        if (res.status === 401) {
            handleLogout();
            throw new Error("登录已过期，请重新登录");
        }
        return res;
    }, [handleLogout, token]);

    const requestAiPrompt = useCallback((prompt, responseFormat = 'text') => {
        return requestAiCompletion(fetchWithAuth, { prompt, responseFormat });
    }, [fetchWithAuth]);

    // --- Init ---
    useEffect(() => {
        recordsRef.current = records;
    }, [records]);

    useEffect(() => {
        if (!token) return undefined;

        let cancelled = false;
        loadXlsxLibrary().catch(error => console.error('Excel 组件加载失败', error));

        const fetchData = async () => {
            try {
                const [dataRes, settingsRes] = await Promise.all([
                    fetchWithAuth(`${API_BASE}/data`),
                    fetchWithAuth(`${API_BASE}/settings`)
                ]);

                if (!dataRes.ok) throw new Error("获取数据失败");
                if (!settingsRes.ok) throw new Error("获取设置失败");

                const data = await dataRes.json();
                const today = getTodayDateString();
                const migratedData = (Array.isArray(data) ? data : []).map(record => normalizeReviewRecord(record, today));
                const staleSameDayRecords = (Array.isArray(data) ? data : [])
                    .filter(record => (record?.sameDayReviewTarget ?? 0) > 0 && record?.sameDayReviewDate !== today)
                    .map(record => normalizeReviewRecord(record, today));

                const serverSettings = normalizeAppSettings(await settingsRes.json());
                const cachedSettings = readSettingsCache();
                const effectiveSettings = normalizeAppSettings({
                    ...cachedSettings,
                    ...serverSettings
                });

                if (cancelled) return;

                setRecords(migratedData);
                setIsDataLoaded(true);
                setSettings(effectiveSettings);
                setApiKeyDraft(serverSettings.apiKey || '');
                setApiKeySaveStatus(serverSettings.apiKey ? 'saved' : 'idle');
                setApiKeySaveMessage(serverSettings.apiKey ? '当前 API Key 已从服务端加载。' : '');
                setSettingsLoaded(true);
                writeSettingsCache(effectiveSettings);

                if (staleSameDayRecords.length > 0) {
                    Promise.all(staleSameDayRecords.map(record =>
                        fetchWithAuth(`${API_BASE}/records/${record.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(record)
                        })
                    )).catch(error => {
                        console.error('清理过期当天巩固状态失败', error);
                    });
                }
            } catch (error) {
                console.error(error);
                if (!cancelled) {
                    setSettings(readSettingsCache());
                    setApiKeyDraft('');
                    setApiKeySaveStatus('idle');
                    setApiKeySaveMessage('');
                    setSettingsLoaded(true);
                }
            }
        };
        fetchData();
        return () => {
            cancelled = true;
        };
    }, [fetchWithAuth, token]);

    useEffect(() => {
        if (!token || !settingsLoaded) return undefined;

        const timeoutId = window.setTimeout(async () => {
            try {
                await fetchWithAuth(`${API_BASE}/settings`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(publicSettings)
                });
                writeSettingsCache(publicSettings);
            } catch (error) {
                console.error('保存设置失败', error);
            }
        }, 400);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [fetchWithAuth, publicSettings, settingsLoaded, token]);

    const updateSetting = (key, val) => {
        setSettings(previous => {
            if (key === 'provider') {
                const preset = getAiProviderPreset(val);
                return {
                    ...previous,
                    provider: val,
                    dsBaseUrl: preset.baseUrl || '',
                    dsModel: preset.model || previous.dsModel
                };
            }

            return { ...previous, [key]: val };
        });
    };
    const updateInviteCodeDraft = (key, value) => setInviteCodeDraft(previous => ({ ...previous, [key]: value }));
    const updateApiKeyDraft = value => {
        setApiKeyDraft(value);
        setApiKeySaveStatus('idle');
        setApiKeySaveMessage('');
    };

    const handleSaveApiKey = useCallback(async () => {
        const trimmedApiKey = apiKeyDraft.trim();

        setIsSavingApiKey(true);
        setApiKeySaveStatus('idle');
        setApiKeySaveMessage('');

        try {
            const response = await fetchWithAuth(`${API_BASE}/settings/api-key`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey: trimmedApiKey })
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || '保存 API Key 失败');
            }

            setSettings(previous => ({ ...previous, apiKey: trimmedApiKey }));
            setApiKeyDraft(trimmedApiKey);
            setApiKeySaveStatus('saved');
            setApiKeySaveMessage(trimmedApiKey ? 'API Key 已保存到服务端。' : '服务端 API Key 已清空。');
        } catch (error) {
            console.error('保存 API Key 失败', error);
            setApiKeySaveStatus('error');
            setApiKeySaveMessage(error.message || '保存 API Key 失败');
        } finally {
            setIsSavingApiKey(false);
        }
    }, [apiKeyDraft, fetchWithAuth]);

    const loadInviteCodes = useCallback(async () => {
        if (!token) return;

        setInviteCodesLoading(true);
        setInviteCodeError('');

        try {
            const response = await fetchWithAuth(`${API_BASE}/admin/invite-codes`);

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
            setIsAdmin(true);
            setAdminStatusChecked(true);
            setInviteCodes(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('获取邀请码失败', error);
            if (error.message !== '登录已过期，请重新登录') {
                setInviteCodeError(error.message || '获取邀请码失败');
                setAdminStatusChecked(true);
            }
        } finally {
            setInviteCodesLoading(false);
        }
    }, [fetchWithAuth, token]);

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

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || '创建邀请码失败');
            }

            setInviteCodeDraft({ code: '', maxUses: '1' });
            await loadInviteCodes();
        } catch (error) {
            console.error('创建邀请码失败', error);
            setInviteCodeError(error.message || '创建邀请码失败');
        } finally {
            setIsCreatingInviteCode(false);
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

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || '更新邀请码失败');
            }

            await loadInviteCodes();
        } catch (error) {
            console.error('更新邀请码失败', error);
            setInviteCodeError(error.message || '更新邀请码失败');
        } finally {
            setInviteCodeMutatingId(null);
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

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || '删除邀请码失败');
            }

            await loadInviteCodes();
        } catch (error) {
            console.error('删除邀请码失败', error);
            setInviteCodeError(error.message || '删除邀请码失败');
        } finally {
            setInviteCodeMutatingId(null);
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
        if (!inputWord) return;
        
        const payload = {
            creationSource: 'manual',
            date: inputDate,
            word: inputWord,
            sentence: inputSentence,
            customMeaning: inputMeaning
        };

        setSaveStatus('saving');
        try {
            // 发送请求给后端，后端生成 ID 并返回完整对象
            const res = await fetchWithAuth(`${API_BASE}/records`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!res.ok) throw new Error('保存失败');
            const newRecord = await res.json();

            // 更新本地状态
            setRecords(p => [...p, newRecord]);
            setLatestLookupRecordId(newRecord.id);
            setLookupPanelState(previous => ({
                ...previous,
                [newRecord.id]: createLookupPanelEntry(hasAiConfig(settings))
            }));
            
            // 清空输入
            setInputWord(''); setInputSentence(''); setInputMeaning('');
            setSaveStatus('saved');

            void requestDictionaryForRecord(newRecord);
            if (hasAiConfig(settings)) {
                void callAIAnalysis(newRecord, { silent: true, updateLookupPanel: true });
            }
        } catch (err) {
            console.error(err);
            setSaveStatus('error');
            alert("添加失败，请检查网络");
        }
    };

    // 2. 改 (Update)
    const updateRecord = async (updatedRecord) => {
        // 乐观更新
        setRecords(prev => prev.map(r => r.id === updatedRecord.id ? updatedRecord : r));
        setReviewQueue(prev => prev.map(r => r.id === updatedRecord.id ? updatedRecord : r));
        if (modalRecord && modalRecord.id === updatedRecord.id) {
            setModalRecord(updatedRecord);
        }

        // 后台静默发送请求
        try {
            await fetchWithAuth(`${API_BASE}/records/${updatedRecord.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedRecord)
            });
        } catch (err) {
            console.error("同步失败", err);
            setSaveStatus('error');
        }
    };

    // 3. 删 (Delete)
    const handleDelete = async (id) => {
        if (!confirm("删除?")) return;

        const originalRecords = [...records];
        setRecords(p => p.filter(r => r.id !== id));
        if (latestLookupRecordId === id) {
            setLatestLookupRecordId(null);
        }

        try {
            await fetchWithAuth(`${API_BASE}/records/${id}`, { method: 'DELETE' });
        } catch {
            alert("删除失败，可能是网络原因");
            setRecords(originalRecords); // 回滚
        }
    };

    // 4. 批量添加 (Batch Add)
    const handleBatchAddRecords = async (newItems, creationSource = 'batch') => {
        setSaveStatus('saving');
        const today = getCalendarDateString();
        
        // 并发发送请求
        const promises = newItems.map(item => {
            const payload = {
                creationSource,
                date: today,
                word: item.word,
                sentence: item.sentence || '',
                customMeaning: item.meaning || '',
            };
            return fetchWithAuth(`${API_BASE}/records`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).then(async res => {
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data?.error || '保存失败');
                }
                return res.json();
            });
        });

        try {
            const createdRecords = await Promise.all(promises);
            setRecords(p => [...p, ...createdRecords]);
            alert(`已成功添加 ${createdRecords.length} 个单词到列表！`);
            setView('list');
            setSaveStatus('saved');
        } catch (err) {
            console.error(err);
            setSaveStatus('error');
            alert("部分单词添加失败，请检查网络");
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
        const today = getTodayDateString();
        return records.filter(record => !record.mastered && !record.isFocusReview && record.nextReviewDate <= today);
    }, [records]);

    const focusDueRecords = useMemo(() => {
        const today = getTodayDateString();
        return sortFocusRecords(records.filter(record => !record.mastered && record.isFocusReview && record.nextReviewDate <= today));
    }, [records]);

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

    const handleReviewResult = (quality) => {
        if (!currentReviewItem) return;
        const record = currentReviewItem;
        const isReinforce = record.needsReadingPractice;
        const today = getTodayDateString();

        setReviewHistory(prev => [
            ...prev,
            {
                queueTab: reviewTab,
                queue: reviewQueue.map(item => JSON.parse(JSON.stringify(item))),
                record: JSON.parse(JSON.stringify(record))
            }
        ]);

        const performanceRecord = applyReviewPerformance(record, quality, today);

        if (quality === 'forget' || quality === 'hard') {
            const updatedRecord = startSameDayReview(performanceRecord, quality, today);
            updateRecord(updatedRecord);

            if (updatedRecord.isFocusReview && reviewTab !== 'focus') {
                setReviewQueue(prev => prev.slice(1).filter(item => item.id !== updatedRecord.id));
            } else {
                setReviewQueue(prev => reinsertReviewItem(prev, updatedRecord));
            }
            setIsFlipped(false);
            return;
        }

        if (isSameDayReviewActive(performanceRecord, today)) {
            const { completed, record: progressedRecord } = progressSameDayReview(performanceRecord, today);
            const updatedRecord = completed ? maybeExitFocusReview(progressedRecord) : progressedRecord;
            updateRecord(updatedRecord);

            if (completed) {
                setReviewQueue(prev => prev.slice(1).filter(item => item.id !== updatedRecord.id));
            } else {
                setReviewQueue(prev => reinsertReviewItem(prev, updatedRecord));
            }
            setIsFlipped(false);
            return;
        }

        const interval = getNextReviewInterval(record.reviewStage, isReinforce);
        if (interval === null) {
            handleMaster(record.id);
            return;
        }
        const newStage = record.reviewStage + 1;
        const nextDateStr = getFutureDateString(interval);

        const updatedRecord = maybeExitFocusReview({
            ...clearSameDayReviewFields(performanceRecord),
            reviewStage: newStage,
            nextReviewDate: nextDateStr
        });
        updateRecord(updatedRecord);
        setReviewQueue(prev => prev.slice(1));
        setIsFlipped(false);
    };

    const handleUndoReview = () => {
        if (reviewHistory.length === 0) return;
        const lastEntry = reviewHistory[reviewHistory.length - 1];
        setReviewTab(lastEntry.queueTab);
        updateRecord(lastEntry.record);
        setReviewQueue(lastEntry.queue);
        setReviewHistory(prev => prev.slice(0, -1));
        setIsFlipped(false);
    };
    reviewResultHandlerRef.current = handleReviewResult;

    const handleMaster = (id) => {
        const r = records.find(r => r.id === id);
        updateRecord({
            ...clearFocusReviewFields(clearSameDayReviewFields(r)),
            mastered: true,
            masteredDate: getTodayDateString()
        });
        setReviewQueue(prev => prev.filter(item => item.id !== id));
        setIsFlipped(false);
    };

    const handleResurrect = (id) => {
        const r = records.find(r => r.id === id);
        updateRecord({
            ...clearFocusReviewFields(clearSameDayReviewFields(r)),
            mastered: false,
            masteredDate: null,
            reviewStage: 0,
            nextReviewDate: getTodayDateString()
        });
    };

    const toggleReadingPractice = (id) => {
        const r = records.find(r => r.id === id);
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
        updateLookupState(record.id, {
            dictionaryError: '',
            dictionaryStatus: 'loading'
        });

        try {
            const dictionaryResult = await requestDictionaryLookup(fetchWithAuth, {
                sentence: record.sentence,
                word: record.word
            });

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
            console.error(error);
            updateLookupState(record.id, {
                dictionaryError: error.message || '词典请求失败',
                dictionaryStatus: 'error'
            });
        }
    };

    const callAIAnalysis = async (record, options = {}) => {
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

    const handleImportClick = () => fileInputRef.current.click();
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
            const today = getTodayDateString();
            if (listFilterDate === 'overdue') res = res.filter(r => !r.mastered && r.nextReviewDate < today);
            else if (listFilterDate === 'today') res = res.filter(r => !r.mastered && r.nextReviewDate === today);
            else if (listFilterDate === 'tomorrow') {
                const tmrStr = getFutureDateString(1);
                res = res.filter(r => !r.mastered && r.nextReviewDate === tmrStr);
            }
            else if (listFilterDate === 'future') res = res.filter(r => !r.mastered && r.nextReviewDate > today);
        }
        return res;
    }, [records, filterLang, listFilterStage, listFilterDate]);

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

    const exportFrequencyExcel = () => {
        if (!window.XLSX) return alert("Excel 组件未加载");
        const dataToExport = frequencyData.map(item => ({ "单词": item.word, "出现次数": item.count }));
        const ws = window.XLSX.utils.json_to_sheet(dataToExport);
        const wb = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(wb, ws, "词频统计");
        window.XLSX.writeFile(wb, `词频统计_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    const exportDateArchiveExcel = () => {
        if (!window.XLSX) return alert("Excel 组件未加载");
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

        const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>听写测试 - ${selectedScope.title} - ${dictationDate}</title>
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
              <div class="meta">类型: ${selectedScope.title} | 日期: ${dictationDate} | 题数: ${questions.length}</div>
              ${questions.map((q, i) => `
                <div class="question-row">
                  <span class="q-num">${i + 1}.</span>
                  <span class="q-content">${q.content}</span>
                  <span class="q-space"></span>
                  <span class="q-answer">${q.answer}</span>
                </div>
              `).join('')}
          </div>
          <div class="list-key">
              <h1>听写测试 <span style="font-size:0.6em; font-weight:normal; color:#666">(答案卷)</span></h1>
              <div class="meta">核对区 | ${selectedScope.title}</div>
              ${questions.map((q, i) => `
                <div class="question-row">
                  <span class="q-num">${i + 1}.</span>
                  <span class="q-content">${q.content}</span>
                  <span class="q-space" style="visibility:hidden"></span>
                  <span class="q-answer">${q.answer}</span>
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
                handleLogout={handleLogout}
                inviteCodeDraft={inviteCodeDraft}
                inviteCodeError={inviteCodeError}
                inviteCodeMutatingId={inviteCodeMutatingId}
                inviteCodes={inviteCodes}
                inviteCodesLoading={inviteCodesLoading}
                isAdmin={isAdmin}
                isCreatingInviteCode={isCreatingInviteCode}
                isBatchAnalyzing={isBatchAnalyzing}
                isSavingApiKey={isSavingApiKey}
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
                provider={provider}
                recordsCount={records.length}
                reviewShortcutEasy={settings.reviewShortcutEasy}
                reviewShortcutForget={settings.reviewShortcutForget}
                reviewShortcutHard={settings.reviewShortcutHard}
                reviewQueueLength={mainDueRecords.length + focusDueRecords.length}
                saveStatus={saveStatus}
                showSettings={showSettings}
                showReviewSentence={settings.showReviewSentence}
                view={view}
            />

            <main className="max-w-5xl mx-auto p-4 md:p-6 pb-20">

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
                        saveStatus={saveStatus}
                    />
                )}

                {view === 'review' && (
                    <ReviewView
                        currentQuestionType={currentQuestionType}
                        currentReviewItem={currentReviewItem}
                        focusBoardRecords={focusBoardRecords}
                        focusQueueCount={focusDueRecords.length}
                        handleMaster={handleMaster}
                        handleReviewResult={handleReviewResult}
                        handleUndoReview={handleUndoReview}
                        isFlipped={isFlipped}
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

                {view === 'list' && (
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

                {view === 'frequency' && (
                    <FrequencyView
                        filterLang={filterLang}
                        frequencyData={frequencyData}
                        onExportFrequencyExcel={exportFrequencyExcel}
                        onOpenModal={setModalRecord}
                        onSetFilterLang={setFilterLang}
                    />
                )}

                {view === 'date' && (
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
                            <MeaningSection record={modalRecord} onUpdate={updateRecord} />
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
