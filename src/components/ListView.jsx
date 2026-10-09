import { BookOpen, Filter, Search, Sparkles, Trash2, Trophy, Zap } from 'lucide-react';

export default function ListView({
    filteredRecords,
    listFilterDate,
    listSearchQuery,
    listFilterStage,
    onDelete,
    onOpenModal,
    onSetListFilterDate,
    onSetListSearchQuery,
    onSetListFilterStage,
    onToggleReadingPractice
}) {
    return (
        <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 bg-slate-50 border-b flex flex-col md:flex-row gap-4 justify-between items-center">
                    <div className="flex items-center gap-2 text-slate-500">
                        <Filter className="w-4 h-4" />
                        <span className="text-sm font-bold">筛选</span>
                    </div>
                    <div className="flex gap-2 flex-wrap w-full md:w-auto md:justify-end">
                        <div className="relative min-w-[220px] flex-1 md:flex-none">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={listSearchQuery}
                                onChange={event => onSetListSearchQuery(event.target.value)}
                                placeholder="搜索单词、释义、例句..."
                                className="w-full text-sm border border-slate-300 rounded px-3 py-1.5 pl-9 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <select
                            value={listFilterStage}
                            onChange={event => onSetListFilterStage(event.target.value)}
                            className="text-sm border border-slate-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="all">所有阶段</option>
                            <option value="mastered">已毕业 (Mastered)</option>
                            {Array.from({ length: 13 }, (_, index) => (
                                <option key={index} value={index}>{`Stage ${index}`}</option>
                            ))}
                        </select>
                        <select
                            value={listFilterDate}
                            onChange={event => onSetListFilterDate(event.target.value)}
                            className="text-sm border border-slate-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="all">所有日期</option>
                            <option value="overdue">⚠️ 已超期 (需复习)</option>
                            <option value="today">📅 今天到期</option>
                            <option value="tomorrow">⏳ 明天到期</option>
                            <option value="future">🔭 未来任务</option>
                        </select>
                    </div>
                </div>
                <div className="divide-y md:hidden">
                    {filteredRecords.map(record => (
                        <article key={record.id} className="p-4 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="font-bold text-slate-800 break-words">{record.word}</div>
                                    {record.reading && <div className="text-xs text-slate-500 mt-1 break-words">{record.reading}</div>}
                                </div>
                                <span className="shrink-0 text-xs text-slate-500">{record.mastered ? '已掌握' : `Lv.${record.reviewStage}`}</span>
                            </div>
                            <div className="text-xs text-slate-500">{record.mastered ? '已掌握' : `下次复习：${record.nextReviewDate || '待安排'}`}</div>
                            <div className="flex items-center justify-between gap-3">
                                <button
                                    onClick={() => onToggleReadingPractice(record.id)}
                                    className={`text-xs px-3 py-2 rounded border flex items-center gap-1 ${record.needsReadingPractice ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}
                                    aria-label={`${record.word}：${record.needsReadingPractice ? '切换为标准模式' : '切换为强化模式'}`}
                                >
                                    {record.needsReadingPractice ? <Zap className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
                                    {record.needsReadingPractice ? '强化' : '标准'}
                                </button>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => onOpenModal(record)} className="rounded-lg border border-indigo-200 px-3 py-2 text-indigo-700 text-xs font-medium" aria-label={`查看 ${record.word} 的详情`}>
                                        详情
                                    </button>
                                    <button onClick={() => onDelete(record.id)} className="rounded-lg border border-red-200 px-3 py-2 text-red-700 text-xs font-medium" aria-label={`删除 ${record.word}`}>
                                        删除
                                    </button>
                                </div>
                            </div>
                        </article>
                    ))}
                    {filteredRecords.length === 0 && <p className="p-8 text-center text-slate-400 text-sm">没有匹配的单词</p>}
                </div>
                <table className="hidden md:table w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b">
                        <tr>
                            <th className="p-4">单词</th>
                            <th className="p-4">下次复习</th>
                            <th className="p-4">阶段</th>
                            <th className="p-4">模式</th>
                            <th className="p-4">操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredRecords.map(record => (
                            <tr key={record.id} className={`border-b hover:bg-slate-50 ${record.mastered ? 'bg-amber-50/30' : ''}`}>
                                <td className="p-4">
                                    <div className="font-bold text-slate-800">{record.word}</div>
                                    <div className="text-xs text-slate-400">{record.reading}</div>
                                </td>
                                <td className="p-4 text-xs">
                                    {record.mastered ? (
                                        <span className="text-amber-500 flex items-center gap-1">
                                            <Trophy className="w-3 h-3" /> 已掌握
                                        </span>
                                    ) : (
                                        record.nextReviewDate
                                    )}
                                </td>
                                <td className="p-4 text-xs font-mono">{record.mastered ? 'MAX' : `Lv.${record.reviewStage}`}</td>
                                <td className="p-4">
                                    <button
                                        onClick={() => onToggleReadingPractice(record.id)}
                                        className={`text-xs px-2 py-1 rounded border flex items-center gap-1 ${record.needsReadingPractice ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}
                                        title={record.needsReadingPractice ? '强化模式' : '标准模式'}
                                    >
                                        {record.needsReadingPractice ? <Zap className="w-3 h-3" /> : <BookOpen className="w-3 h-3" />}
                                        {record.needsReadingPractice ? '强化' : '标准'}
                                    </button>
                                </td>
                                <td className="p-4 flex gap-2">
                                    <button onClick={() => onDelete(record.id)} className="text-red-400 hover:text-red-600" aria-label={`删除 ${record.word}`}>
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => onOpenModal(record)} className="text-indigo-400 hover:text-indigo-600" aria-label={`查看 ${record.word} 的详情`}>
                                        <Sparkles className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {filteredRecords.length === 0 && (
                            <tr>
                                <td colSpan="5" className="p-8 text-center text-slate-400">
                                    没有匹配的单词
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
