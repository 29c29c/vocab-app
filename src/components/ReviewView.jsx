import {
    GraduationCap,
    RotateCcw,
    Trophy,
    Volume2,
    Zap
} from 'lucide-react';

import MeaningSection from './MeaningSection.jsx';

function MasteredList({ onResurrect, records }) {
    const masteredRecords = records
        .filter(record => record.mastered)
        .sort((left, right) => new Date(right.masteredDate) - new Date(left.masteredDate));

    if (masteredRecords.length === 0) {
        return <div className="text-center py-10 text-slate-400">荣誉殿堂空空如也，快去复习吧！</div>;
    }

    return (
        <div className="grid gap-4">
            {masteredRecords.map(record => (
                <div key={record.id} className="bg-white p-4 rounded-xl border border-amber-100 shadow-sm flex justify-between items-center">
                    <div>
                        <div className="flex items-center gap-2">
                            <Trophy className="w-4 h-4 text-amber-500" />
                            <h3 className="font-bold text-slate-800">{record.word}</h3>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">掌握于 {record.masteredDate}</p>
                    </div>
                    <button onClick={() => onResurrect(record.id)} className="text-xs text-indigo-500 hover:underline">
                        重新学习
                    </button>
                </div>
            ))}
        </div>
    );
}

export default function ReviewView({
    currentQuestionType,
    currentReviewItem,
    handleMaster,
    handleReviewResult,
    handleUndoReview,
    isFlipped,
    onResurrect,
    playTTS,
    records,
    reviewHistory,
    reviewQueue,
    reviewTab,
    setIsFlipped,
    setReviewTab,
    updateRecord
}) {
    return (
        <div className="space-y-6">
            <div className="flex justify-center">
                <div className="bg-slate-200 p-1 rounded-full flex">
                    <button
                        onClick={() => setReviewTab('queue')}
                        className={`px-6 py-2 rounded-full text-sm font-bold transition ${reviewTab === 'queue' ? 'bg-white text-indigo-700 shadow' : 'text-slate-500'}`}
                    >
                        今日任务 ({reviewQueue.length})
                    </button>
                    <button
                        onClick={() => setReviewTab('mastered')}
                        className={`px-6 py-2 rounded-full text-sm font-bold transition ${reviewTab === 'mastered' ? 'bg-white text-amber-600 shadow' : 'text-slate-500'}`}
                    >
                        荣誉殿堂
                    </button>
                </div>
            </div>

            {reviewTab === 'queue' && (
                <div className="max-w-md mx-auto relative min-h-[500px]">
                    {reviewQueue.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-3xl shadow-sm border border-slate-100">
                            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl">🎉</div>
                            <h3 className="text-xl font-bold text-slate-800">今日任务已完成！</h3>
                            <p className="text-slate-500 mt-2">休息一下，明天继续加油。</p>
                        </div>
                    ) : (
                        <div className="perspective-1000">
                            <div className="flex items-center justify-between text-xs text-slate-400 mb-2 px-2">
                                <span>Queue: {reviewQueue.length} left</span>
                                <span>
                                    Stage: {currentReviewItem.reviewStage} {currentReviewItem.needsReadingPractice ? '(强化)' : ''}
                                </span>
                            </div>
                            <div
                                onClick={() => setIsFlipped(!isFlipped)}
                                className={`relative w-full bg-white rounded-3xl shadow-2xl border border-slate-100 p-8 cursor-pointer transition-all duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}
                                style={{ minHeight: '400px' }}
                            >
                                <div className={`absolute inset-0 backface-hidden flex flex-col items-center justify-center p-8 ${isFlipped ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                                    <div className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-4">
                                        {currentQuestionType === 'A' ? '👀 看字读音' : currentQuestionType === 'B' ? '👂 听音辨义' : '🧠 回忆意思'}
                                    </div>
                                    {(currentQuestionType === 'A' || currentQuestionType === 'C') && (
                                        <h2 className="text-4xl font-black text-slate-800 text-center mb-6">{currentReviewItem.word}</h2>
                                    )}
                                    {currentQuestionType === 'B' && (
                                        <div className="text-center">
                                            <button
                                                onClick={event => {
                                                    event.stopPropagation();
                                                    playTTS(currentReviewItem.reading || currentReviewItem.word);
                                                }}
                                                className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 hover:bg-indigo-200 transition"
                                            >
                                                <Volume2 className="w-8 h-8" />
                                            </button>
                                            <p className="text-2xl font-bold text-slate-600">{currentReviewItem.reading || '(无读音数据)'}</p>
                                        </div>
                                    )}
                                    <p className="text-slate-400 text-sm mt-8 animate-pulse">点击翻转查看答案</p>
                                </div>

                                <div className={`absolute inset-0 backface-hidden rotate-y-180 flex flex-col p-6 overflow-y-auto ${!isFlipped ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="text-2xl font-bold text-indigo-900">{currentReviewItem.word}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-lg text-indigo-600 font-mono">{currentReviewItem.reading}</span>
                                                <button
                                                    onClick={event => {
                                                        event.stopPropagation();
                                                        playTTS(currentReviewItem.word);
                                                    }}
                                                >
                                                    <Volume2 className="w-4 h-4 text-slate-400 hover:text-indigo-600" />
                                                </button>
                                            </div>
                                        </div>
                                        <button
                                            onClick={event => {
                                                event.stopPropagation();
                                                handleMaster(currentReviewItem.id);
                                            }}
                                            className="bg-amber-100 text-amber-600 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 hover:bg-amber-200"
                                        >
                                            <GraduationCap className="w-3 h-3" /> 毕业
                                        </button>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 mb-4">
                                        <p className="text-slate-600 italic">"{currentReviewItem.sentence}"</p>
                                    </div>
                                    <div className="flex-1 overflow-y-auto text-sm text-slate-600 space-y-2">
                                        <MeaningSection record={currentReviewItem} onUpdate={updateRecord} />
                                    </div>
                                </div>
                            </div>

                            {isFlipped && (
                                <div className="flex gap-3 mt-6 justify-center animate-in slide-in-from-bottom-4">
                                    <button onClick={() => handleReviewResult('forget')} className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 py-3 rounded-xl font-bold flex flex-col items-center">
                                        <span className="text-lg">😰</span>
                                        <span className="text-xs">忘记了</span>
                                    </button>
                                    <button onClick={() => handleReviewResult('hard')} className="flex-1 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 py-3 rounded-xl font-bold flex flex-col items-center">
                                        <span className="text-lg">🤔</span>
                                        <span className="text-xs">模糊</span>
                                    </button>
                                    <button onClick={() => handleReviewResult('easy')} className="flex-1 bg-green-100 hover:bg-green-200 text-green-700 py-3 rounded-xl font-bold flex flex-col items-center">
                                        <span className="text-lg">😎</span>
                                        <span className="text-xs">记得</span>
                                    </button>
                                </div>
                            )}

                            <div className="flex justify-end mt-4 h-8">
                                {reviewHistory.length > 0 && (
                                    <button onClick={handleUndoReview} className="text-slate-400 hover:text-indigo-600 text-sm flex items-center gap-1 transition-colors">
                                        <RotateCcw className="w-4 h-4" /> 撤销上一步
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {reviewTab === 'mastered' && <MasteredList records={records} onResurrect={onResurrect} />}
        </div>
    );
}
