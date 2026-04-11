import { useState } from 'react';
import { FileText, Plus, RefreshCw, Sparkles, Trash2, X } from 'lucide-react';

import { hasAiConfig } from '../client/defaultSettings.js';

export default function ArticleAnalyzer({ settings, requestAiPrompt, onAddWords, onCancel }) {
    const [step, setStep] = useState('input');
    const [text, setText] = useState('');
    const [extractedItems, setExtractedItems] = useState([]);
    const [userSelection, setUserSelection] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isSelectionAnalyzing, setIsSelectionAnalyzing] = useState(false);

    const analyzeText = async () => {
        if (!text.trim()) return alert('请输入文章内容');
        if (!hasAiConfig(settings)) return alert('请先在设置中配置 API Key');

        setIsAnalyzing(true);
        const promptText = `
            Please analyze the following article provided by the user. 
            Identify 10 to 20 key idiomatic expressions, phrasal verbs, or advanced vocabulary (CEFR B2-C2 level) that are important for understanding the text.
            Return the result strictly as a JSON array. Each object: { "word": "...", "meaning": "Chinese meaning", "sentence": "Context sentence" }.
            Article Content: ${text.slice(0, 4000)} 
        `;

        try {
            let jsonString = await requestAiPrompt(promptText, 'json_object');
            jsonString = jsonString.replace(/```json|```/g, '').trim();
            const rawObject = JSON.parse(jsonString);
            const parsed = Array.isArray(rawObject) ? rawObject : (rawObject.words || rawObject.items || []);

            const items = parsed.map((item, index) => ({
                id: Date.now() + index,
                word: item.word,
                meaning: item.meaning,
                sentence: item.sentence,
                checked: true
            }));
            setExtractedItems(items);
            setStep('result');
        } catch (error) {
            alert(`解析失败: ${error.message}`);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleTextMouseUp = () => {
        const selection = window.getSelection().toString().trim();
        if (selection) setUserSelection(selection);
    };

    const handleAddSelection = async () => {
        if (!userSelection) return;
        if (extractedItems.some(item => item.word.toLowerCase() === userSelection.toLowerCase())) return alert('该词已在列表中');
        if (!hasAiConfig(settings)) return alert('请先在设置中配置 API Key');

        setIsSelectionAnalyzing(true);
        try {
            const escapedSelection = userSelection.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const sentences = text.match(/[^.!?。！？\n]+[.!?。！？\n]+/g) || [text];
            const foundSentence = sentences.find(sentence => new RegExp(escapedSelection, 'i').test(sentence)) || '';

            const promptText = `Explain "${userSelection}" in Chinese. Context: "${foundSentence.trim()}". Return JSON: { "meaning": "...", "sentence": "..." }`;
            const rawText = await requestAiPrompt(promptText, 'json_object');

            let jsonResult = { meaning: rawText, sentence: foundSentence.trim() };
            try {
                const parsed = JSON.parse(rawText.replace(/```json|```/g, '').trim());
                jsonResult.meaning = parsed.meaning || rawText;
            } catch {
                // Fall back to the raw model output when the provider does not return valid JSON.
            }

            setExtractedItems(previous => [
                {
                    id: Date.now(),
                    word: userSelection,
                    meaning: jsonResult.meaning,
                    sentence: jsonResult.sentence,
                    checked: true
                },
                ...previous
            ]);
            setUserSelection('');
        } catch (error) {
            alert(`查询失败: ${error.message}`);
        } finally {
            setIsSelectionAnalyzing(false);
        }
    };

    const renderHighlightedArticle = () => {
        if (!text) return null;

        const keywords = extractedItems.map(item => item.word).filter(Boolean).sort((left, right) => right.length - left.length);
        if (keywords.length === 0) return <div className="whitespace-pre-wrap">{text}</div>;

        const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`(${keywords.map(escapeRegExp).join('|')})`, 'gi');
        const parts = text.split(pattern);

        return (
            <div className="whitespace-pre-wrap text-slate-700 leading-7" onMouseUp={handleTextMouseUp}>
                {parts.map((part, index) => {
                    const match = extractedItems.find(item => item.word.toLowerCase() === part.toLowerCase());
                    return match ? (
                        <span
                            key={index}
                            className="bg-yellow-200 border-b-2 border-yellow-400 text-yellow-900 font-medium px-0.5 rounded cursor-pointer hover:bg-yellow-300 transition"
                            title={match.meaning}
                        >
                            {part}
                        </span>
                    ) : (
                        part
                    );
                })}
            </div>
        );
    };

    return (
        <div className="bg-white rounded-2xl shadow-xl border border-indigo-50 flex flex-col h-[calc(100vh-140px)] animate-in zoom-in-95">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50/50 rounded-t-2xl">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-600" /> 文章智能解析
                </h2>
                <button onClick={onCancel} className="p-2 hover:bg-slate-200 rounded-full">
                    <X className="w-5 h-5 text-slate-500" />
                </button>
            </div>
            <div className="flex-1 overflow-hidden flex flex-col p-6">
                {step === 'input' ? (
                    <div className="flex flex-col h-full max-w-3xl mx-auto w-full gap-4">
                        <div className="bg-indigo-50 p-4 rounded-xl text-indigo-800 text-sm flex gap-2">
                            <Sparkles className="w-5 h-5 flex-shrink-0" />
                            <p>输入或粘贴英语/日语文章，AI 将自动识别其中的地道表达、习惯用语和生僻词。</p>
                        </div>
                        <textarea
                            className="flex-1 w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 ring-indigo-500 outline-none resize-none text-slate-700 text-lg leading-relaxed"
                            placeholder="请在此粘贴文章内容..."
                            value={text}
                            onChange={event => setText(event.target.value)}
                        />
                        <button
                            onClick={analyzeText}
                            disabled={isAnalyzing || !text.trim()}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white py-4 rounded-xl font-bold text-lg shadow-lg flex justify-center items-center gap-2 transition"
                        >
                            {isAnalyzing ? (
                                <>
                                    <RefreshCw className="w-5 h-5 animate-spin" /> 解析中...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-5 h-5" /> 开始智能识别
                                </>
                            )}
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col md:flex-row h-full gap-6 overflow-hidden">
                        <div className="flex-1 flex flex-col min-h-0 bg-slate-50 rounded-xl border border-slate-200 overflow-hidden relative group">
                            <div className="p-3 bg-white border-b text-xs text-slate-500 flex justify-between items-center">
                                <span>原文预览 (试着划选文本)</span>
                                {userSelection && (
                                    <button
                                        onClick={handleAddSelection}
                                        disabled={isSelectionAnalyzing}
                                        className="bg-indigo-600 text-white px-3 py-1 rounded text-xs animate-in fade-in slide-in-from-right-2 shadow-lg flex items-center gap-1"
                                    >
                                        {isSelectionAnalyzing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                                        添加选中
                                    </button>
                                )}
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">{renderHighlightedArticle()}</div>
                        </div>
                        <div className="w-full md:w-96 flex flex-col min-h-0 bg-white rounded-xl border border-indigo-100 shadow-lg overflow-hidden">
                            <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex justify-between items-center">
                                <h3 className="font-bold text-indigo-900 flex items-center gap-2">识别结果 ({extractedItems.length})</h3>
                                <div className="text-xs space-x-2">
                                    <button onClick={() => setExtractedItems(previous => previous.map(item => ({ ...item, checked: true })))} className="text-indigo-600 hover:underline">
                                        全选
                                    </button>
                                    <span className="text-slate-300">|</span>
                                    <button onClick={() => setExtractedItems(previous => previous.map(item => ({ ...item, checked: false })))} className="text-slate-500 hover:underline">
                                        全不选
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                                {extractedItems.map(item => (
                                    <div key={item.id} className={`p-3 rounded-lg border transition-all flex gap-3 ${item.checked ? 'bg-white border-indigo-200 shadow-sm' : 'bg-slate-50 border-transparent opacity-60'}`}>
                                        <div className="pt-1">
                                            <input
                                                type="checkbox"
                                                checked={item.checked}
                                                onChange={event => setExtractedItems(previous => previous.map(entry => entry.id === item.id ? { ...entry, checked: event.target.checked } : entry))}
                                                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start">
                                                <input
                                                    value={item.word}
                                                    onChange={event => setExtractedItems(previous => previous.map(entry => entry.id === item.id ? { ...entry, word: event.target.value } : entry))}
                                                    className="font-bold text-slate-800 bg-transparent border-b border-transparent focus:border-indigo-300 outline-none w-full"
                                                />
                                            </div>
                                            <input
                                                value={item.meaning}
                                                placeholder="输入中文释义..."
                                                onChange={event => setExtractedItems(previous => previous.map(entry => entry.id === item.id ? { ...entry, meaning: event.target.value } : entry))}
                                                className="text-sm text-slate-600 mt-1 bg-transparent border-b border-transparent focus:border-indigo-300 outline-none w-full"
                                            />
                                            {item.sentence && <p className="text-xs text-slate-400 mt-1 truncate" title={item.sentence}>{item.sentence}</p>}
                                        </div>
                                        <button onClick={() => setExtractedItems(previous => previous.filter(entry => entry.id !== item.id))} className="text-slate-300 hover:text-red-400">
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div className="p-4 border-t bg-slate-50">
                                <button
                                    onClick={() => {
                                        const toAdd = extractedItems.filter(item => item.checked);
                                        if (toAdd.length === 0) return alert('请至少选择一个');
                                        onAddWords(toAdd);
                                    }}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 transition"
                                >
                                    保存 {extractedItems.filter(item => item.checked).length} 个单词
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
