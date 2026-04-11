import { Plus, RefreshCw, Save } from 'lucide-react';

export default function InputView({
    inputDate,
    inputMeaning,
    inputSentence,
    inputWord,
    onInputDateChange,
    onInputMeaningChange,
    onInputSentenceChange,
    onInputWordChange,
    onSubmit,
    saveStatus
}) {
    return (
        <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl border border-indigo-50 p-8 animate-in zoom-in-95">
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
    );
}
