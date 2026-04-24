import { useState } from 'react';
import { BrainCircuit, Edit3 } from 'lucide-react';

const MarkdownRenderer = ({ content }) => {
    if (!content) return null;
    const lines = content.split('\n').filter(line => line.trim() !== '');

    return (
        <div className="space-y-3 text-slate-700 leading-relaxed text-sm md:text-base">
            {lines.map((line, index) => {
                const parts = line.split(/(\*\*.*?\*\*)/g);
                return (
                    <div key={index} className="min-h-[1.5em]">
                        {parts.map((part, partIndex) => {
                            if (part.startsWith('**') && part.endsWith('**')) {
                                return (
                                    <strong key={partIndex} className="text-indigo-700 font-bold">
                                        {part.slice(2, -2)}
                                    </strong>
                                );
                            }

                            if (part.match(/^(\d+\.|-)\s/)) {
                                return (
                                    <span key={partIndex} className="font-semibold text-slate-500 mr-1">
                                        {part}
                                    </span>
                                );
                            }

                            return part;
                        })}
                    </div>
                );
            })}
        </div>
    );
};

export default function MeaningSection({ record, onUpdate }) {
    const [isEditing, setIsEditing] = useState(false);
    const [tempMeaning, setTempMeaning] = useState(record.customMeaning || '');

    const handleSave = () => {
        onUpdate({ ...record, customMeaning: tempMeaning });
        setIsEditing(false);
    };

    const stopCardFlip = event => {
        event.stopPropagation();
    };

    return (
        <div className="space-y-4">
            <div className="bg-yellow-50/50 border border-yellow-100 rounded-xl p-4 transition-all hover:border-yellow-200">
                <div className="flex justify-between items-start mb-2">
                    <h4 className="text-xs font-bold text-yellow-600 uppercase tracking-wider flex items-center gap-1">
                        <Edit3 className="w-3 h-3" /> 我的笔记 / 手动释义
                    </h4>
                    {!isEditing && (
                        <button
                            onClick={event => {
                                stopCardFlip(event);
                                setIsEditing(true);
                            }}
                            className="text-xs text-yellow-600 hover:underline"
                        >
                            {record.customMeaning ? '编辑' : '添加'}
                        </button>
                    )}
                </div>

                {isEditing ? (
                    <div className="flex gap-2" onClick={stopCardFlip} onMouseDown={stopCardFlip}>
                        <input
                            type="text"
                            value={tempMeaning}
                            onChange={event => setTempMeaning(event.target.value)}
                            placeholder="输入你的自定义释义..."
                            className="flex-1 text-sm p-2 border border-yellow-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                            autoFocus
                            onKeyDown={event => event.key === 'Enter' && handleSave()}
                        />
                        <button onClick={handleSave} className="text-xs bg-yellow-500 text-white px-3 rounded hover:bg-yellow-600">
                            保存
                        </button>
                    </div>
                ) : (
                    <div>
                        {record.customMeaning ? (
                            <p className="text-sm text-slate-800 font-medium">{record.customMeaning}</p>
                        ) : (
                            <button
                                onClick={event => {
                                    stopCardFlip(event);
                                    setIsEditing(true);
                                }}
                                className="w-full text-left text-xs text-slate-400 border border-dashed border-slate-300 rounded p-2 hover:bg-slate-50 transition-colors"
                            >
                                + 点击添加手动释义 (优先展示)
                            </button>
                        )}
                    </div>
                )}
            </div>

            <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm relative">
                <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <BrainCircuit className="w-3 h-3" /> AI 深度解析
                    </h4>
                </div>
                {record.aiAnalysis ? (
                    <MarkdownRenderer content={record.aiAnalysis} />
                ) : (
                    <div className="text-center py-4 text-slate-400">
                        <p className="text-xs">暂无 AI 解析</p>
                    </div>
                )}
            </div>
        </div>
    );
}
