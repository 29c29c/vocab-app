import { FileSpreadsheet, Printer, Trash2 } from 'lucide-react';

import LanguageTabs from './LanguageTabs.jsx';

export default function DateArchiveView({
    dateGroupedData,
    filterLang,
    onDelete,
    onExportDateArchiveExcel,
    onOpenModal,
    onSetFilterLang,
    onShowDictationModal
}) {
    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm gap-4">
                <h2 className="font-bold text-slate-800">日期归档</h2>
                <div className="flex items-center gap-3">
                    <LanguageTabs filterLang={filterLang} onChange={onSetFilterLang} />
                    <button onClick={onShowDictationModal} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm flex gap-2">
                        <Printer className="w-4 h-4" /> 生成听写纸
                    </button>
                    <button onClick={onExportDateArchiveExcel} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm flex gap-2">
                        <FileSpreadsheet className="w-4 h-4" /> 导出 Excel
                    </button>
                </div>
            </div>
            {dateGroupedData.length === 0 ? (
                <div className="text-center py-10 text-slate-400">该语种下暂无数据</div>
            ) : (
                dateGroupedData.map(group => (
                    <div key={group.date} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                        <div className="bg-slate-50 px-5 py-3 border-b flex justify-between">
                            <span className="font-bold text-slate-700">{group.date}</span>
                            <span className="text-xs bg-white px-2 py-1 rounded border">{group.items.length} 条</span>
                        </div>
                        <div className="divide-y">
                            {group.items.map(item => (
                                <div key={item.id} className="p-5 hover:bg-slate-50">
                                    <div className="flex justify-between items-start gap-3">
                                        <div className="min-w-0">
                                            <span className="font-bold text-indigo-700 break-all">{item.word}</span>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <span className="text-xs text-slate-400">#{item.id}</span>
                                            <button
                                                onClick={() => onDelete(item.id)}
                                                className="text-red-400 hover:text-red-600"
                                                title="删除单词"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-sm text-slate-600 mt-1">{item.sentence}</p>
                                    {(item.customMeaning || item.aiAnalysis) && (
                                        <div
                                            className="mt-2 text-xs text-indigo-800 bg-indigo-50 p-2 rounded line-clamp-2 cursor-pointer hover:bg-indigo-100"
                                            onClick={() => onOpenModal(item)}
                                        >
                                            {item.customMeaning ? `[笔记] ${item.customMeaning}` : '点击查看解析'}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}
