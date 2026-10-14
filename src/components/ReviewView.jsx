import { useRef } from 'react';
import { ArrowRight, Check, CheckCheck, GraduationCap, Headphones, RotateCcw, Volume2, Zap } from 'lucide-react';
import MeaningSection from './MeaningSection.jsx';
import { getReviewGesture } from '../client/reviewGestures.js';

function RecordBoard({ records, mastered = false, onResurrect }) {
    if (!records.length) return <div className="empty-state"><GraduationCap size={32} /><h3>{mastered ? '你的积累，会在这里开花。' : '暂时没有需要重点巩固的词。'}</h3><p>{mastered ? '完成复习，或把熟悉的词标记为已掌握。' : '反复忘记的词会自动进入这里。'}</p></div>;
    return <div className="record-board">{records.map(record => <div className="board-row" key={record.id}>
        <div><h3>{record.word}</h3><p>{record.customMeaning || record.dictionaryMeaning || record.reading}</p><small>{mastered ? `掌握于 ${record.masteredDate}` : `下次复习 ${record.nextReviewDate} · 忘记 ${record.forgetCount} 次 · 模糊 ${record.hardCount} 次 · 恢复 ${record.focusRecoveryStreak}/2`}</small></div>
        {mastered ? <button className="secondary-button" onClick={() => onResurrect(record.id)}>重新学习</button> : <Zap size={19} className="focus-icon" />}
    </div>)}</div>;
}

export default function ReviewView({ currentQuestionType, currentReviewItem, focusBoardRecords, focusQueueCount,
    handleMaster, handleReviewResult, handleUndoReview, isFlipped, isPartial, isReviewBusy, mainQueueCount,
    onResurrect, onSetView, playTTS, records, reviewHistory, reviewQueue, reviewTab, showReviewSentence,
    setIsFlipped, setReviewTab, updateRecord, reviewShortcutEasy, reviewShortcutForget, reviewShortcutHard }) {
    const masteredRecords = records.filter(record => record.mastered).sort((a, b) => String(b.masteredDate).localeCompare(String(a.masteredDate)));
    const pendingIds = new Set(reviewQueue.map(record => record.id));
    const completedCount = new Set(reviewHistory.filter(entry => entry.queueTab === reviewTab && !pendingIds.has(entry.record.id)).map(entry => entry.record.id)).size;
    const total = completedCount + reviewQueue.length;
    const progress = total ? Math.round(completedCount / total * 100) : 100;
    const item = currentReviewItem;
    const pointerStart = useRef(null);
    const suppressClick = useRef(false);
    const tabs = [{ id: 'queue', label: '今日任务', count: mainQueueCount }, { id: 'focus', label: '重点巩固', count: focusQueueCount }, { id: 'mastered', label: '已掌握', count: isPartial ? null : masteredRecords.length }];
    const label = currentQuestionType === 'A' ? '看字读音' : currentQuestionType === 'B' ? '听音辨义' : '回忆词义';
    const score = quality => { if (!isReviewBusy && isFlipped) void handleReviewResult(quality); };
    const finishGesture = event => {
        const start = pointerStart.current;
        pointerStart.current = null;
        if (!start || start.id !== event.pointerId) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        const action = getReviewGesture({ deltaX: dx, deltaY: dy, isRevealed: isFlipped });
        // A drag or scroll must not also toggle the answer through its click event.
        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) suppressClick.current = true;
        if (!action) return;
        suppressClick.current = true;
        if (action === 'reveal') setIsFlipped(true);
        else score(action);
    };
    return <section className={`review-page ${reviewTab !== 'mastered' && item ? 'has-review-card' : ''}`}>
        <div className="review-intro"><h1><span className="mobile-review-title">今日复习</span><span className="desktop-review-title">每一次回想，都在靠近掌握。</span></h1><p><span className="desktop-review-title">反复遇见、主动回忆，让这些词真正成为你的知识。</span><span className="mobile-review-title">每一次回想，都在靠近掌握。</span></p></div>
        <div className="review-layout"><div className="review-workspace">
            <div className="review-tabs" role="tablist" aria-label="复习分类">{tabs.map(tab => <button key={tab.id} role="tab" aria-selected={reviewTab === tab.id} disabled={isReviewBusy || (tab.id === 'mastered' && isPartial)} onClick={() => { setIsFlipped(false); setReviewTab(tab.id); }} className={reviewTab === tab.id ? 'active' : ''}>{tab.label}{tab.count !== null && <span>{tab.count}</span>}</button>)}</div>
            {reviewTab === 'mastered' ? <RecordBoard records={masteredRecords} mastered onResurrect={onResurrect} /> : !item ? <>
                <div className="review-complete"><div className="complete-icon"><CheckCheck size={34} strokeWidth={1.6} /></div><h2>{reviewTab === 'queue' ? '今天的复习，完成了。' : '重点巩固任务已完成。'}</h2><p>{reviewTab === 'queue' ? '给记忆一点时间。下次到期，我们再见。' : '难词也在慢慢变熟悉，继续保持。'}</p><div className="complete-actions"><button className="primary-button" onClick={() => onSetView('input')}>记录一个新词<ArrowRight size={17} /></button>{reviewTab === 'queue' && focusQueueCount > 0 && <button className="secondary-button" onClick={() => setReviewTab('focus')}>继续重点巩固 · {focusQueueCount}</button>}</div></div>
                {reviewHistory.length > 0 && <button className="undo-button complete-undo" onClick={handleUndoReview} disabled={isReviewBusy}><RotateCcw size={15} />撤销上一步</button>}
                {reviewTab === 'focus' && <RecordBoard records={focusBoardRecords} />}
            </> : <>
                <div className="review-progress"><div className="progress-track" role="progressbar" aria-label="本轮完成进度" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${progress}%` }} /></div><span>已完成 {completedCount}<i />待复习 {reviewQueue.length}</span></div>
                <article className={`flashcard ${isFlipped ? 'is-revealed' : ''}`} aria-label={isFlipped ? '单词答案' : label} aria-busy={isReviewBusy} tabIndex={0}
                    onKeyDown={event => { if (event.key === 'Enter' && event.target === event.currentTarget && !isReviewBusy) setIsFlipped(previous => !previous); }}
                    onPointerDown={event => {
                        suppressClick.current = false;
                        pointerStart.current = null;
                        if (event.pointerType !== 'touch' || event.target.closest('button, input, textarea, select, a, summary, .meaning-editor') || window.getSelection()?.toString()) return;
                        pointerStart.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
                        event.currentTarget.setPointerCapture(event.pointerId);
                    }} onPointerUp={finishGesture} onPointerCancel={() => { pointerStart.current = null; }}
                    onClick={event => {
                        if (suppressClick.current) { suppressClick.current = false; return; }
                        if (!isReviewBusy && !event.target.closest('button, input, textarea, select, a, summary, .meaning-editor') && !window.getSelection()?.toString()) setIsFlipped(previous => !previous);
                    }}>
                    <div className="flashcard-meta"><span>{isFlipped ? '核对答案' : label}</span><span>{item.sameDayReviewTarget > 0 ? `今日巩固 ${item.sameDayReviewDone}/${item.sameDayReviewTarget}` : `阶段 ${item.reviewStage}${item.needsReadingPractice ? ' · 读音强化' : ''}`}</span></div>
                    {isFlipped ? <div className="answer-content" key={`answer-${item.id}`}>
                        <div className="answer-word-row"><div className="min-w-0"><h2 className="answer-word">{item.word}</h2>{item.reading && <p className="word-reading">{item.reading}</p>}</div><button className="sound-button" onClick={() => playTTS(item.word)} aria-label="播放单词发音"><Volume2 size={22} /></button></div>
                        {item.sentence && <blockquote className="answer-sentence">{item.sentence}</blockquote>}
                        <MeaningSection key={`${item.id}:${item.revision}:${item.clientMutationId || ''}`} record={item} onUpdate={updateRecord} compact expandAnalysisOnMobile />
                        <button className="master-button" onClick={() => handleMaster(item.id)} disabled={isReviewBusy}><GraduationCap size={16} />这个词已熟悉，标记掌握</button>
                    </div> : <div className="question-content" key={`question-${item.id}`}>
                        {currentQuestionType === 'B' ? <><button className="listen-button" onClick={() => playTTS(item.word)} aria-label="播放听音题"><Headphones size={36} strokeWidth={1.6} /></button><h2 className="listen-title">听一听，想一想。</h2><p className="listening-hint">点击播放，回想单词和含义</p></> : <div className="question-word-row"><h2 className="question-word">{item.word}</h2>{currentQuestionType === 'C' && <button className="sound-button" onClick={() => playTTS(item.word)} aria-label="播放单词发音"><Volume2 size={23} strokeWidth={1.7} /></button>}</div>}
                        {currentQuestionType !== 'B' && <span className="word-divider" />}
                        {currentQuestionType !== 'B' && (showReviewSentence && currentQuestionType !== 'B' && item.sentence ? <blockquote className="question-sentence">{item.sentence}</blockquote> : <p className="recall-prompt">{currentQuestionType === 'A' ? '试着说出它的读音，再核对答案。' : '先在心里回想，再看看答案。'}</p>)}
                    </div>}
                </article>
                <div className="review-dock">
                    {isFlipped ? <div className="rating-buttons">
                        <button className="rating-button forget" onClick={() => score('forget')} disabled={isReviewBusy}><span>忘记</span><small>再学一遍<kbd>{reviewShortcutForget}</kbd></small></button>
                        <button className="rating-button hard" onClick={() => score('hard')} disabled={isReviewBusy}><span>模糊</span><small>再巩固<kbd>{reviewShortcutHard}</kbd></small></button>
                        <button className="rating-button easy" onClick={() => score('easy')} disabled={isReviewBusy}><span>记得<Check size={17} /></span><small>继续<kbd>{reviewShortcutEasy}</kbd></small></button>
                    </div> : <button className="reveal-button" onClick={() => setIsFlipped(true)} disabled={isReviewBusy}>显示答案<ArrowRight size={19} /><kbd>空格</kbd></button>}
                    <div className="review-dock-footer"><span className="desktop-shortcuts"><kbd>空格</kbd> 显示答案 · {reviewShortcutForget} 忘记 · {reviewShortcutHard} 模糊 · {reviewShortcutEasy} 记得</span><span className="mobile-gesture-hint">{isFlipped ? '左滑忘记 · 右滑记得' : '轻点词卡或按钮，查看答案'}</span><button className="undo-button" onClick={handleUndoReview} disabled={isReviewBusy || !reviewHistory.length}><RotateCcw size={15} />撤销<span className="undo-extra">上一步</span></button></div>
                </div>
            </>}
        </div><aside className="review-aside"><h3>学习提示</h3><p>先试着回忆这个单词的意思。想一想它在句子中的含义，再点「显示答案」查看。</p><p>主动回忆，比直接看答案更有助于记忆。</p><div className="aside-rule" /><p className="aside-note">不确定也没关系。<br />如实评分，我们会安排它再次出现。</p></aside></div>
    </section>;
}
