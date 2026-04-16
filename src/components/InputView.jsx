import {
    BookOpen,
    Clock3,
    History,
    Plus,
    RefreshCw,
    Save,
    Sparkles
} from 'lucide-react';

function formatDateTime(value) {
    if (!value) return '刚刚';

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return String(value);
    }

    return parsed.toLocaleString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        month: '2-digit',
        day: '2-digit'
    });
}

function StatusPill({ status, text }) {
    const styles = {
        error: 'bg-rose-50 text-rose-600 border-rose-200',
        idle: 'bg-slate-100 text-slate-500 border-slate-200',
        loading: 'bg-amber-50 text-amber-700 border-amber-200',
        success: 'bg-emerald-50 text-emerald-700 border-emerald-200'
    };

    return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${styles[status] || styles.idle}`}>
            {status === 'loading' && <RefreshCw className="w-3 h-3 animate-spin" />}
            {text}
        </span>
    );
}

function extractMeaningFromAi(text) {
    if (!text) return '';

    const match = text.match(/(?:\*\*)?(?:常见解释|短释义|确切含义|含义|Meaning)(?:\*\*)?[:：]\s*([^\n]+)/i);
    if (match) {
        return match[1].trim();
    }

    return '';
}

function getCompactMeaning(item, lookupEntry) {
    const candidates = [
        item.customMeaning,
        item.dictionaryMeaning,
        lookupEntry?.dictionaryResult?.definitions?.[0],
        extractMeaningFromAi(item.aiAnalysis)
    ];

    for (const candidate of candidates) {
        const normalized = String(candidate || '').trim();
        if (normalized) {
            return normalized;
        }
    }

    return '暂未生成释义';
}

function renderDictionaryState(latestLookupState) {
    if (!latestLookupState) {
        return <p className="text-sm text-slate-400">保存后会优先显示词典结果。</p>;
    }

    if (latestLookupState.dictionaryStatus === 'loading') {
        return <p className="text-sm text-slate-500">正在查询词典结果...</p>;
    }

    if (latestLookupState.dictionaryStatus === 'error') {
        return <p className="text-sm text-rose-500">{latestLookupState.dictionaryError || '词典暂不可用'}</p>;
    }

    if (latestLookupState.dictionaryStatus !== 'success') {
        return <p className="text-sm text-slate-400">词典结果尚未开始查询。</p>;
    }

    const result = latestLookupState.dictionaryResult;
    const hasDefinitions = Array.isArray(result?.definitions) && result.definitions.length > 0;
    const hasExamples = Array.isArray(result?.examples) && result.examples.length > 0;
    const hasPos = Array.isArray(result?.partsOfSpeech) && result.partsOfSpeech.length > 0;

    if (!hasDefinitions && !result?.reading && !result?.phonetic) {
        return <p className="text-sm text-slate-500">词典里暂时没有找到这个词的结果。</p>;
    }

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-sm">
                {result?.reading && (
                    <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 font-medium">
                        读音: {result.reading}
                    </span>
                )}
                {result?.phonetic && (
                    <span className="px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 font-medium">
                        音标: {result.phonetic}
                    </span>
                )}
                {hasPos && result.partsOfSpeech.map(item => (
                    <span key={item} className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-medium">
                        {item}
                    </span>
                ))}
            </div>
            {hasDefinitions && (
                <div className="space-y-1.5">
                    {result.definitions.map((item, index) => (
                        <p key={`${item}-${index}`} className="text-sm text-slate-700 leading-6">
                            {index + 1}. {item}
                        </p>
                    ))}
                </div>
            )}
            {hasExamples && (
                <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
                    {result.examples.map((item, index) => (
                        <p key={`${item}-${index}`} className="text-sm text-slate-600 italic leading-6">
                            {item}
                        </p>
                    ))}
                </div>
            )}
        </div>
    );
}

function renderAiState(latestLookupState, latestLookupRecord) {
    if (!latestLookupState) {
        return <p className="text-sm text-slate-400">AI 解析会在词典结果后补充显示。</p>;
    }

    if (latestLookupState.aiStatus === 'loading') {
        return <p className="text-sm text-slate-500">AI 正在生成更完整的释义与搭配...</p>;
    }

    if (latestLookupState.aiStatus === 'error') {
        return <p className="text-sm text-rose-500">{latestLookupState.aiError || 'AI 请求失败'}</p>;
    }

    if (latestLookupState.aiStatus === 'idle' && latestLookupState.aiError) {
        return <p className="text-sm text-slate-500">{latestLookupState.aiError}</p>;
    }

    const content = latestLookupState.aiResult?.content || latestLookupRecord?.aiAnalysis || '';
    if (!content) {
        return <p className="text-sm text-slate-400">AI 结果尚未返回。</p>;
    }

    return (
        <div className="bg-slate-950 rounded-2xl p-4 text-slate-100 text-sm leading-6 whitespace-pre-wrap">
            {content}
        </div>
    );
}

function RecentManualEntry({ item, lookupEntry }) {
    const compactMeaning = getCompactMeaning(item, lookupEntry);

    return (
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">{item.word}</p>
                        {item.reading && (
                            <span className="text-xs text-indigo-600 font-medium truncate">{item.reading}</span>
                        )}
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-1">{compactMeaning}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <StatusPill
                        status={item.aiAnalysis ? 'success' : 'idle'}
                        text={item.aiAnalysis ? 'AI' : '待补'}
                    />
                    <p className="text-[11px] text-slate-400">{formatDateTime(item.createdAt || item.date)}</p>
                </div>
            </div>
        </div>
    );
}

function getLatestDictionaryStatusText(status) {
    if (status === 'success') return '词典已返回';
    if (status === 'error') return '词典有异常';
    if (status === 'idle') return '词典待查询';
    return '词典处理中';
}

function getLatestAiStatusText(status) {
    if (status === 'success') return 'AI 已返回';
    if (status === 'error') return 'AI 有异常';
    if (status === 'idle') return 'AI 待补充';
    return 'AI 处理中';
}

export default function InputView({
    inputDate,
    inputMeaning,
    inputSentence,
    inputWord,
    latestLookupRecord,
    latestLookupState,
    onInputDateChange,
    onInputMeaningChange,
    onInputSentenceChange,
    onInputWordChange,
    onSubmit,
    lookupPanelState,
    recentManualEntries,
    saveStatus
}) {
    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-white rounded-2xl shadow-xl border border-indigo-50 p-8 animate-in zoom-in-95">
                <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <Plus className="w-6 h-6 text-indigo-600" /> 新词录入
                </h2>
                <form onSubmit={onSubmit} className="space-y-5">
                    <div>
                        <label className="text-sm font-bold text-slate-500">日期</label>
                        <input
                            type="date"
                            value={inputDate}
                            onChange={event => onInputDateChange(event.target.value)}
                            className="w-full mt-1 p-3 bg-slate-50 rounded-xl border-slate-200 focus:ring-2 ring-indigo-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-bold text-slate-500">
                            单词 <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={inputWord}
                            onChange={event => onInputWordChange(event.target.value)}
                            placeholder="Enter word..."
                            className="w-full mt-1 p-3 bg-slate-50 rounded-xl border-slate-200 focus:ring-2 ring-indigo-500 outline-none text-lg font-bold text-indigo-900"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-bold text-slate-500">句子 (可选)</label>
                        <textarea
                            rows="3"
                            value={inputSentence}
                            onChange={event => onInputSentenceChange(event.target.value)}
                            placeholder="Example sentence..."
                            className="w-full mt-1 p-3 bg-slate-50 rounded-xl border-slate-200 focus:ring-2 ring-indigo-500 outline-none resize-none text-base"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-bold text-slate-500">中文释义 (可选)</label>
                        <input
                            type="text"
                            value={inputMeaning}
                            onChange={event => onInputMeaningChange(event.target.value)}
                            placeholder="Manual meaning..."
                            className="w-full mt-1 p-3 bg-slate-50 rounded-xl border-slate-200 focus:ring-2 ring-indigo-500 outline-none text-base"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={saveStatus === 'saving'}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-indigo-200 transition transform active:scale-95 disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                        {saveStatus === 'saving' ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        {saveStatus === 'saving' ? '正在保存...' : '保存并开始记忆'}
                    </button>
                </form>
            </div>

            {(latestLookupRecord || recentManualEntries.length > 0) && (
                <div className="space-y-5">
                    {latestLookupRecord && (
                        <section className="bg-white rounded-2xl shadow-xl border border-amber-100 p-6">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <p className="text-sm font-bold text-amber-500 flex items-center gap-2">
                                        <Sparkles className="w-4 h-4" /> 本次录入结果
                                    </p>
                                    <h3 className="text-2xl font-bold text-slate-900 mt-2 break-all">{latestLookupRecord.word}</h3>
                                    <p className="text-sm text-slate-400 mt-2 flex items-center gap-2">
                                        <Clock3 className="w-4 h-4" /> {formatDateTime(latestLookupRecord.createdAt || latestLookupRecord.date)}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <StatusPill
                                        status={latestLookupState?.dictionaryStatus || 'idle'}
                                        text={getLatestDictionaryStatusText(latestLookupState?.dictionaryStatus || 'idle')}
                                    />
                                    <StatusPill
                                        status={latestLookupState?.aiStatus || 'idle'}
                                        text={getLatestAiStatusText(latestLookupState?.aiStatus || 'idle')}
                                    />
                                </div>
                            </div>

                            {(latestLookupRecord.sentence || latestLookupRecord.customMeaning) && (
                                <div className="grid gap-3 md:grid-cols-2 mt-5">
                                    <div className="rounded-2xl bg-slate-50 p-4">
                                        <p className="text-xs font-bold text-slate-400 mb-2">原句</p>
                                        <p className="text-sm text-slate-700 leading-6">
                                            {latestLookupRecord.sentence || '未填写原句'}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl bg-slate-50 p-4">
                                        <p className="text-xs font-bold text-slate-400 mb-2">手动释义</p>
                                        <p className="text-sm text-slate-700 leading-6">
                                            {latestLookupRecord.customMeaning || '未填写手动释义'}
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="grid gap-4 mt-5">
                                <div className="rounded-2xl border border-indigo-100 p-4">
                                    <div className="flex items-center gap-2 mb-3 text-indigo-700 font-bold">
                                        <BookOpen className="w-4 h-4" /> 词典结果
                                    </div>
                                    {renderDictionaryState(latestLookupState)}
                                </div>

                                <div className="rounded-2xl border border-slate-200 p-4">
                                    <div className="flex items-center gap-2 mb-3 text-slate-700 font-bold">
                                        <Sparkles className="w-4 h-4" /> AI 解析
                                    </div>
                                    {renderAiState(latestLookupState, latestLookupRecord)}
                                </div>
                            </div>
                        </section>
                    )}

                    {recentManualEntries.length > 0 && (
                        <section className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <History className="w-5 h-5 text-slate-500" />
                                <h3 className="text-lg font-bold text-slate-800">最近 5 次手动录入</h3>
                            </div>
                            <div className="space-y-3">
                                {recentManualEntries.map(item => (
                                    <RecentManualEntry
                                        key={item.id}
                                        item={item}
                                        lookupEntry={lookupPanelState[item.id]}
                                    />
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            )}
        </div>
    );
}
