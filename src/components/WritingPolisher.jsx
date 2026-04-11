import { useState } from 'react';
import {
    Check,
    Coffee,
    FileText,
    GraduationCap as AcademicCap,
    PenTool,
    Plus,
    RefreshCw,
    Sparkles,
    X,
    Briefcase
} from 'lucide-react';

import { hasAiConfig } from '../client/defaultSettings.js';

export default function WritingPolisher({ settings, requestAiPrompt, onAddWords, onCancel }) {
    const [targetLang, setTargetLang] = useState('English');
    const [scene, setScene] = useState('business');
    const [inputText, setInputText] = useState('');
    const [isPolishing, setIsPolishing] = useState(false);
    const [result, setResult] = useState(null);
    const [viewMode, setViewMode] = useState('diff');

    const scenes = {
        business: {
            label: '商务 Business',
            icon: Briefcase,
            color: 'text-blue-600',
            desc: '强调礼貌、专业、简洁。适合邮件、提案。'
        },
        academic: {
            label: '学术 Academic',
            icon: AcademicCap,
            color: 'text-purple-600',
            desc: '强调严谨、客观、高级词汇。适合论文、报告。'
        },
        casual: {
            label: '日常 Casual',
            icon: Coffee,
            color: 'text-orange-600',
            desc: '强调地道口语、轻松、俚语。适合聊天、社交。'
        }
    };

    const handlePolish = async () => {
        if (!inputText.trim()) return alert('请输入内容');
        if (!hasAiConfig(settings)) return alert('请先在设置中配置 API Key');

        setIsPolishing(true);
        const promptText = `
            You are an expert writing coach specialized in helping users sound like a native speaker in specific social contexts.
            
            Task: Polish the user's text to make it sound native, fluent, and perfectly suited for the "${scene}" (${scenes[scene].desc}) context. The target language is ${targetLang}.
            
            Return ONLY a valid JSON object with this structure（输出为中文！）:
            {
                "full_text": "The complete polished text",
                "diff_segments": [
                    {"text": "original text part ", "type": "same"}, 
                    {"text": "removed part", "type": "removed"}, 
                    {"text": "added part", "type": "added"}
                ],
                "critique": [
                    {"point": "Tone/Grammar", "comment": "Why you made specific changes (e.g., 'Too informal for business')"}
                ],
                "vocabulary": [
                    {
                        "original": "The word/phrase user used", 
                        "better": "The better native expression", 
                        "explanation": "Why this is better in this context", 
                        "full_sentence": "A complete sentence using the better expression (can be from the text)"
                    }
                ]
            }

            *CRITICAL INSTRUCTION FOR DIFF*: 
            Break down the text so that "removed" (original bad parts) and "added" (new better parts) are clearly distinguishable. 
            "same" means text that didn't change.
            
            User's Draft:
            ${inputText}
        `;

        try {
            const rawText = await requestAiPrompt(promptText, 'json_object');
            const jsonString = rawText.replace(/```json|```/g, '').trim();
            const parsed = JSON.parse(jsonString);

            if (parsed.vocabulary) {
                parsed.vocabulary = parsed.vocabulary.map((item, index) => ({
                    ...item,
                    id: Date.now() + index,
                    checked: false
                }));
            }

            setResult(parsed);
        } catch (error) {
            console.error(error);
            alert(`润色失败: ${error.message} (请检查 API Key 或重试)`);
        } finally {
            setIsPolishing(false);
        }
    };

    const handleSaveVocab = () => {
        if (!result || !result.vocabulary) return;

        const toAdd = result.vocabulary
            .filter(item => item.checked)
            .map(item => ({
                word: item.better,
                sentence: item.full_sentence,
                meaning: `[${scene.toUpperCase()}] ${item.explanation} (原: ${item.original})`
            }));

        if (toAdd.length === 0) return alert('请勾选需要收藏的表达');
        onAddWords(toAdd);
    };

    return (
        <div className="bg-white rounded-2xl shadow-xl border border-indigo-50 flex flex-col h-[calc(100vh-140px)] animate-in zoom-in-95 overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-indigo-50/50">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                    <PenTool className="w-5 h-5 text-indigo-600" /> 写作进阶与润色
                </h2>
                <button onClick={onCancel} className="p-2 hover:bg-slate-200 rounded-full">
                    <X className="w-5 h-5 text-slate-500" />
                </button>
            </div>

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                <div className="w-full md:w-1/3 p-5 flex flex-col gap-4 border-r bg-slate-50 overflow-y-auto">
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-500 uppercase">目标语言</label>
                        <div className="flex gap-2">
                            {['English', 'Japanese'].map(language => (
                                <button
                                    key={language}
                                    onClick={() => setTargetLang(language)}
                                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${targetLang === language ? 'bg-white border-indigo-500 text-indigo-700 shadow-sm' : 'bg-slate-100 border-transparent text-slate-500'}`}
                                >
                                    {language}
                                </button>
                            ))}
                        </div>

                        <label className="text-xs font-bold text-slate-500 uppercase mt-2">写作场景</label>
                        <div className="grid gap-2">
                            {Object.entries(scenes).map(([key, config]) => {
                                const Icon = config.icon;
                                const active = scene === key;
                                return (
                                    <button
                                        key={key}
                                        onClick={() => setScene(key)}
                                        className={`p-3 rounded-xl border text-left transition relative overflow-hidden ${active ? 'bg-white border-indigo-300 shadow-md ring-1 ring-indigo-200' : 'bg-slate-100 border-transparent hover:bg-white hover:shadow-sm'}`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <Icon className={`w-4 h-4 ${active ? config.color : 'text-slate-400'}`} />
                                            <span className={`font-bold text-sm ${active ? 'text-slate-800' : 'text-slate-500'}`}>{config.label}</span>
                                        </div>
                                        <p className="text-[10px] text-slate-400 leading-tight">{config.desc}</p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col gap-2 min-h-[200px]">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-bold text-slate-500 uppercase">草稿 (智能输入)</label>
                            <span className="text-xs text-slate-400">{inputText.length} chars</span>
                        </div>
                        <textarea
                            value={inputText}
                            onChange={event => setInputText(event.target.value)}
                            className="flex-1 w-full p-3 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none resize-none text-sm leading-relaxed"
                            placeholder="在此输入你的草稿 (中式英语/日语，或直接中文)..."
                        />
                    </div>

                    <button
                        onClick={handlePolish}
                        disabled={isPolishing || !inputText.trim()}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 flex justify-center items-center gap-2 transition"
                    >
                        {isPolishing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        {isPolishing ? '正在深度润色...' : '智能润色 (Smart Polish)'}
                    </button>
                </div>

                <div className="flex-1 flex flex-col bg-white overflow-hidden relative">
                    {!result ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-300 p-10 text-center">
                            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                <PenTool className="w-10 h-10 opacity-50" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-400">准备就绪</h3>
                            <p className="text-sm max-w-xs mt-2">在左侧选择场景并输入草稿，AI 将帮你摆脱“中式表达”，掌握地道写法。</p>
                        </div>
                    ) : (
                        <div className="flex flex-col h-full">
                            <div className="flex items-center justify-between px-6 py-3 border-b bg-slate-50/50">
                                <div className="flex bg-slate-200 p-1 rounded-lg">
                                    <button
                                        onClick={() => setViewMode('diff')}
                                        className={`px-4 py-1.5 text-xs font-bold rounded-md transition ${viewMode === 'diff' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        差异对比 (Diff)
                                    </button>
                                    <button
                                        onClick={() => setViewMode('clean')}
                                        className={`px-4 py-1.5 text-xs font-bold rounded-md transition ${viewMode === 'clean' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        纯净译文
                                    </button>
                                </div>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(result.full_text);
                                        alert('已复制');
                                    }}
                                    className="text-xs text-slate-500 hover:text-indigo-600 flex items-center gap-1"
                                >
                                    <FileText className="w-3 h-3" /> 复制全文
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                                {viewMode === 'clean' ? (
                                    <div className="prose prose-indigo max-w-none text-slate-700 leading-8 text-lg">
                                        {result.full_text}
                                    </div>
                                ) : (
                                    <div className="text-lg leading-8 text-slate-700">
                                        {result.diff_segments.map((segment, index) => {
                                            if (segment.type === 'removed') {
                                                return (
                                                    <span key={index} className="line-through decoration-red-400 text-red-400 bg-red-50 mx-1 px-1 rounded decoration-2" title="删除/修改">
                                                        {segment.text}
                                                    </span>
                                                );
                                            }

                                            if (segment.type === 'added') {
                                                return (
                                                    <span key={index} className="text-green-700 bg-green-50 font-medium px-1 mx-1 rounded border-b-2 border-green-200" title="AI 建议">
                                                        {segment.text}
                                                    </span>
                                                );
                                            }

                                            return <span key={index}>{segment.text}</span>;
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className="h-2/5 border-t bg-slate-50 flex flex-col min-h-[200px]">
                                <div className="p-3 border-b bg-white flex items-center justify-between">
                                    <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                                        <AcademicCap className="w-4 h-4 text-indigo-500" /> 优化解析 & 语境词库
                                    </h3>
                                    <button onClick={handleSaveVocab} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1.5 rounded-lg shadow transition flex items-center gap-1">
                                        <Plus className="w-3 h-3" /> 收藏选中的表达
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 grid md:grid-cols-2 gap-4 custom-scrollbar">
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase">优化要点 (Critique)</h4>
                                        {result.critique.map((item, index) => (
                                            <div key={index} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-sm">
                                                <span className="font-bold text-slate-700 block mb-1">{item.point}</span>
                                                <span className="text-slate-500">{item.comment}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="space-y-3">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase">地道表达推荐 (Vocabulary)</h4>
                                        {result.vocabulary.map(item => (
                                            <div
                                                key={item.id}
                                                className={`p-3 rounded-xl border transition-all cursor-pointer ${item.checked ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-200' : 'bg-white border-slate-200 hover:border-indigo-200'}`}
                                                onClick={() => {
                                                    const updatedVocabulary = result.vocabulary.map(entry =>
                                                        entry.id === item.id ? { ...entry, checked: !entry.checked } : entry
                                                    );
                                                    setResult({ ...result, vocabulary: updatedVocabulary });
                                                }}
                                            >
                                                <div className="flex justify-between items-start mb-1">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition ${item.checked ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'}`}>
                                                            {item.checked && <Check className="w-3 h-3 text-white" />}
                                                        </div>
                                                        <span className="font-bold text-green-700">{item.better}</span>
                                                    </div>
                                                    <span className="text-xs text-red-400 line-through decoration-red-400 decoration-1 opacity-60">{item.original}</span>
                                                </div>
                                                <p className="text-xs text-slate-600 mb-1">{item.explanation}</p>
                                                <p className="text-[10px] text-slate-400 italic bg-slate-100 p-1.5 rounded mt-1">"{item.full_sentence}"</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
