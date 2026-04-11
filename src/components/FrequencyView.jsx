import { FileSpreadsheet } from 'lucide-react';

import LanguageTabs from './LanguageTabs.jsx';

export default function FrequencyView({
    filterLang,
    frequencyData,
    onExportFrequencyExcel,
    onOpenModal,
    onSetFilterLang
}) {
    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm gap-4">
                <div>
                    <h2 className="font-bold text-slate-800">词频分析</h2>
                    <p className="text-xs text-slate-500">共 {frequencyData.length} 个单词 (当前筛选)</p>
                </div>
                <div className="flex items-center gap-3">
                    <LanguageTabs filterLang={filterLang} onChange={onSetFilterLang} />
                    <button onClick={onExportFrequencyExcel} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm flex gap-2">
                        <FileSpreadsheet className="w-4 h-4" /> 导出 Excel
                    </button>
                </div>
            </div>
            {frequencyData.length === 0 ? (
                <div className="text-center py-10 text-slate-400">该语种下暂无数据</div>
            ) : (
                <div className="grid gap-3">
                    {frequencyData.map((item, index) => (
                        <div key={item.word + index} className="bg-white p-4 rounded-xl border border-slate-200 flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-sm text-slate-500">
                                    {index + 1}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800">{item.word}</h3>
                                    <p className="text-xs text-slate-500">{item.count} 次</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                {item.ids.map(id => (
                                    <button
                                        key={id}
                                        onClick={() => onOpenModal(item.details[id])}
                                        className="px-2 py-1 bg-indigo-50 text-indigo-600 text-xs rounded"
                                    >
                                        #{id}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
