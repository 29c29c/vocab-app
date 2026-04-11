import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    BookOpen, Calendar, BarChart2, Trash2, X,
    Sparkles, BrainCircuit, FileSpreadsheet, Filter,
    Printer, Trophy, Zap
} from 'lucide-react';
import { requestAiCompletion } from './client/aiApi.js';
import { DEFAULT_APP_SETTINGS, hasAiConfig, normalizeAppSettings } from './client/defaultSettings.js';
import { readSettingsCache, writeSettingsCache } from './client/settingsCache.js';
import { loadXlsxLibrary } from './client/xlsxLoader.js';
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

    const [isDataLoaded, setIsDataLoaded] = useState(false);
    const [saveStatus, setSaveStatus] = useState('saved');
    const [isBatchAnalyzing, setIsBatchAnalyzing] = useState(false);

    // 模态框
    const [showDictationModal, setShowDictationModal] = useState(false);
    const [dictationDate, setDictationDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [modalRecord, setModalRecord] = useState(null);

    // 输入框
    const [inputDate, setInputDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [inputWord, setInputWord] = useState('');
    const [inputSentence, setInputSentence] = useState('');
    const [inputMeaning, setInputMeaning] = useState('');

    // 复习
    const [reviewQueue, setReviewQueue] = useState([]); 
    const [reviewHistory, setReviewHistory] = useState([]); 
    const [isFlipped, setIsFlipped] = useState(false);

    // AI & Settings
    const [showSettings, setShowSettings] = useState(false);
    const [settingsLoaded, setSettingsLoaded] = useState(false);
    const fileInputRef = useRef(null);
    const [settings, setSettings] = useState(() => readSettingsCache());
    const { apiKey, provider } = settings;

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
        setSettingsLoaded(false);
    }, []);

    const fetchWithAuth = useCallback(async (url, options = {}) => {
        const headers = { ...options.headers, 'Authorization': `Bearer ${token}` };
        const res = await fetch(url, { ...options, headers });
        if (res.status === 401 || res.status === 403) {
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
                const migratedData = (Array.isArray(data) ? data : []).map(r => ({
                    ...r,
                    customMeaning: r.customMeaning || '',
                    reviewStage: r.reviewStage ?? 0,
                    nextReviewDate: r.nextReviewDate || new Date().toISOString().split('T')[0],
                    mastered: r.mastered ?? false,
                    masteredDate: r.masteredDate || null,
                    reading: r.reading || '',
                    needsReadingPractice: r.needsReadingPractice ?? false
                }));

                const serverSettings = normalizeAppSettings(await settingsRes.json());
                const cachedSettings = readSettingsCache();
                const effectiveSettings = hasAiConfig(serverSettings) ? serverSettings : cachedSettings;

                if (cancelled) return;

                setRecords(migratedData);
                setIsDataLoaded(true);
                setSettings(effectiveSettings);
                setSettingsLoaded(true);
                writeSettingsCache(effectiveSettings);

                if (!hasAiConfig(serverSettings) && hasAiConfig(cachedSettings)) {
                    await fetchWithAuth(`${API_BASE}/settings`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(cachedSettings)
                    });
                }
            } catch (error) {
                console.error(error);
                if (!cancelled) {
                    setSettings(readSettingsCache());
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
                    body: JSON.stringify(settings)
                });
                writeSettingsCache(settings);
            } catch (error) {
                console.error('保存设置失败', error);
            }
        }, 400);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [fetchWithAuth, settings, settingsLoaded, token]);

    const updateSetting = (key, val) => setSettings(p => ({ ...p, [key]: val }));

    // --- CRUD Handlers (实时保存核心) ---

    // 1. 增 (Create)
    const handleAddRecord = async (e) => {
        e.preventDefault();
        if (!inputWord) return;
        
        const payload = {
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
            
            // 自动触发 AI (如果配置了)
            if (hasAiConfig(settings)) await callAIAnalysis(newRecord);
            
            // 清空输入
            setInputWord(''); setInputSentence(''); setInputMeaning('');
            setSaveStatus('saved');
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

        try {
            await fetchWithAuth(`${API_BASE}/records/${id}`, { method: 'DELETE' });
        } catch {
            alert("删除失败，可能是网络原因");
            setRecords(originalRecords); // 回滚
        }
    };

    // 4. 批量添加 (Batch Add)
    const handleBatchAddRecords = async (newItems) => {
        setSaveStatus('saving');
        const today = new Date().toISOString().split('T')[0];
        
        // 并发发送请求
        const promises = newItems.map(item => {
            const payload = {
                date: today,
                word: item.word,
                sentence: item.sentence || '',
                customMeaning: item.meaning || '',
            };
            return fetchWithAuth(`${API_BASE}/records`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).then(res => res.json());
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

    // --- Review Handlers ---
    useEffect(() => {
        if (!isDataLoaded) return;
        const today = new Date().toISOString().split('T')[0];
        setReviewQueue(prev => {
            if (prev.length > 0) return prev;
            const pending = records.filter(r => !r.mastered && r.nextReviewDate <= today);
            return shuffleArray(pending);
        });
    }, [records, isDataLoaded, view]);

    const currentReviewItem = reviewQueue[0];
    const currentQuestionType = currentReviewItem ? getQuestionType(currentReviewItem) : 'C';

    const handleReviewResult = (quality) => {
        if (!currentReviewItem) return;
        const record = currentReviewItem;
        const isReinforce = record.needsReadingPractice;

        setReviewHistory(prev => [...prev, JSON.parse(JSON.stringify(record))]);

        if (quality === 'easy') {
            const interval = getNextReviewInterval(record.reviewStage, isReinforce);
            if (interval === null) {
                handleMaster(record.id);
                return;
            }
            const newStage = record.reviewStage + 1;
            const today = new Date();
            const nextDate = new Date(today);
            nextDate.setDate(today.getDate() + interval);
            const nextDateStr = nextDate.toISOString().split('T')[0];

            updateRecord({ ...record, reviewStage: newStage, nextReviewDate: nextDateStr });
            setReviewQueue(prev => prev.slice(1));
            setIsFlipped(false);
        } else {
            let newStage = record.reviewStage;
            if (quality === 'forget') newStage = 0;
            else if (quality === 'hard') newStage = Math.max(0, record.reviewStage - 1);

            const updatedRecord = { ...record, reviewStage: newStage };
            updateRecord(updatedRecord); 

            setReviewQueue(prev => {
                const rest = prev.slice(1);
                const insertIndex = Math.min(rest.length, 3);
                const newQueue = [...rest];
                newQueue.splice(insertIndex, 0, updatedRecord);
                return newQueue;
            });
            setIsFlipped(false);
        }
    };

    const handleUndoReview = () => {
        if (reviewHistory.length === 0) return;
        const lastRecordState = reviewHistory[reviewHistory.length - 1]; 
        updateRecord(lastRecordState);
        setReviewQueue(prev => {
            const cleanPrev = prev.filter(r => r.id !== lastRecordState.id);
            return [lastRecordState, ...cleanPrev];
        });
        setReviewHistory(prev => prev.slice(0, -1));
        setIsFlipped(false);
    };

    const handleMaster = (id) => {
        const r = records.find(r => r.id === id);
        updateRecord({ ...r, mastered: true, masteredDate: new Date().toISOString().split('T')[0] });
        setReviewQueue(prev => prev.filter(item => item.id !== id));
        setIsFlipped(false);
    };

    const handleResurrect = (id) => {
        const r = records.find(r => r.id === id);
        updateRecord({ ...r, mastered: false, reviewStage: 0, nextReviewDate: new Date().toISOString().split('T')[0] });
    };

    const toggleReadingPractice = (id) => {
        const r = records.find(r => r.id === id);
        updateRecord({ ...r, needsReadingPractice: !r.needsReadingPractice, reviewStage: 0, nextReviewDate: new Date().toISOString().split('T')[0] });
    };

    const extractReadingFromAnalysis = (text) => {
        if (!text) return '';
        const match = text.match(/(?:标音|读音|Reading|发音)[:：]\s*([^\n]+)/i);
        if (match) return match[1].trim();
        const kanaMatch = text.match(/[\u3040-\u309F\u30A0-\u30FF]+/);
        return kanaMatch ? kanaMatch[0] : '';
    };

    const callAIAnalysis = async (record, silent = false) => {
        if (!hasAiConfig(settings)) { if (!silent) alert("请配置 API Key"); return; }
        const promptText = `我正在学习单词。单词：${record.word}。${record.sentence ? '句子：' + record.sentence : '请根据单词造句并解析'}。${record.customMeaning ? '用户备注含义：' + record.customMeaning : ''}。请严格按照以下 Markdown 格式解析：1. **语言识别**: (英语/日语) 2. **标音**: (日语提供假名，英语提供音标) 3. **确切含义**: (解释含义) 4. **语法分析**: (简要说明) 5. **固定搭配**: (列出3个) 请保持简洁。`;
        try {
            const aiContent = await requestAiPrompt(promptText);
            const reading = extractReadingFromAnalysis(aiContent);
            updateRecord({ ...record, aiAnalysis: aiContent, reading: reading || record.reading });
        } catch (e) { console.error(e); if (!silent) alert(e.message); }
    };

    const handleBatchAnalyze = async () => {
        if (!hasAiConfig(settings)) return setShowSettings(true);
        const pending = records.filter(r => !r.aiAnalysis);
        if (pending.length === 0) return alert("没有需要解析的单词");
        if (!confirm(`即将解析 ${pending.length} 个单词，请勿关闭页面。`)) return;
        setIsBatchAnalyzing(true);
        for (const r of pending) { await callAIAnalysis(r, true); await new Promise(res => setTimeout(res, 800)); }
        setIsBatchAnalyzing(false); alert("批量解析完成");
    };

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
                     handleBatchAddRecords(itemsToAdd); // 使用批量添加接口
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
            const today = new Date().toISOString().split('T')[0];
            if (listFilterDate === 'overdue') res = res.filter(r => !r.mastered && r.nextReviewDate < today);
            else if (listFilterDate === 'today') res = res.filter(r => !r.mastered && r.nextReviewDate === today);
            else if (listFilterDate === 'tomorrow') {
                const tmr = new Date(); tmr.setDate(tmr.getDate() + 1);
                const tmrStr = tmr.toISOString().split('T')[0];
                res = res.filter(r => !r.mastered && r.nextReviewDate === tmrStr);
            }
            else if (listFilterDate === 'future') res = res.filter(r => !r.mastered && r.nextReviewDate > today);
        }
        return res;
    }, [records, filterLang, listFilterStage, listFilterDate]);

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

    const extractMeaning = (text) => { if (!text) return ''; const match = text.match(/(?:\*\*)?(?:确切含义|含义|Meaning)(?:\*\*)?[:：]\s*([^\n]+)/i); if (match) return match[1].trim(); return text.slice(0, 30).replace(/\*\*/g, '') + '...'; };

    const generateDictationSheet = () => {
        const targetRecords = records.filter(r => r.date === dictationDate);
        if (targetRecords.length === 0) return alert(`${dictationDate} 没有录入单词`);
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
          <title>听写测试 - ${dictationDate}</title>
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
              <div class="meta">日期: ${dictationDate} | 题数: ${questions.length}</div>
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
              <div class="meta">核对区</div>
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
                apiKey={apiKey}
                currentUser={currentUser}
                fileInputRef={fileInputRef}
                handleBatchAnalyze={handleBatchAnalyze}
                handleFileChange={handleFileChange}
                handleImportClick={handleImportClick}
                handleLogout={handleLogout}
                isBatchAnalyzing={isBatchAnalyzing}
                onSetView={setView}
                onToggleSettings={() => setShowSettings(previous => !previous)}
                onUpdateSetting={updateSetting}
                provider={provider}
                recordsCount={records.length}
                reviewQueueLength={reviewQueue.length}
                saveStatus={saveStatus}
                showSettings={showSettings}
                view={view}
            />

            <main className="max-w-5xl mx-auto p-4 md:p-6 pb-20">

                {view === 'writing' && (
                    <WritingPolisher 
                        settings={settings}
                        requestAiPrompt={requestAiPrompt}
                        onAddWords={handleBatchAddRecords}
                        onCancel={() => setView('input')}
                    />
                )}

                {view === 'article' && (
                    <ArticleAnalyzer 
                        settings={settings}
                        requestAiPrompt={requestAiPrompt}
                        onAddWords={handleBatchAddRecords}
                        onCancel={() => setView('input')}
                    />
                )}

                {view === 'input' && (
                    <InputView
                        inputDate={inputDate}
                        inputMeaning={inputMeaning}
                        inputSentence={inputSentence}
                        inputWord={inputWord}
                        onInputDateChange={setInputDate}
                        onInputMeaningChange={setInputMeaning}
                        onInputSentenceChange={setInputSentence}
                        onInputWordChange={setInputWord}
                        onSubmit={handleAddRecord}
                        saveStatus={saveStatus}
                    />
                )}

                {view === 'review' && (
                    <ReviewView
                        currentQuestionType={currentQuestionType}
                        currentReviewItem={currentReviewItem}
                        handleMaster={handleMaster}
                        handleReviewResult={handleReviewResult}
                        handleUndoReview={handleUndoReview}
                        isFlipped={isFlipped}
                        onResurrect={handleResurrect}
                        playTTS={playTTS}
                        records={records}
                        reviewHistory={reviewHistory}
                        reviewQueue={reviewQueue}
                        reviewTab={reviewTab}
                        setIsFlipped={setIsFlipped}
                        setReviewTab={setReviewTab}
                        updateRecord={updateRecord}
                    />
                )}

                {view === 'list' && (
                    <ListView
                        filteredRecords={filteredRecords}
                        listFilterDate={listFilterDate}
                        listFilterStage={listFilterStage}
                        onDelete={handleDelete}
                        onOpenModal={setModalRecord}
                        onSetListFilterDate={setListFilterDate}
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
