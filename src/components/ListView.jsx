import { BookOpen, Search, SlidersHorizontal, Trash2, Zap } from 'lucide-react';

export default function ListView({ filteredRecords, listFilterDate, listSearchQuery, listFilterStage,
    onDelete, onOpenModal, onSetListFilterDate, onSetListSearchQuery, onSetListFilterStage, onToggleReadingPractice }) {
    return <section className="vocabulary-list">
        <div className="list-toolbar"><label className="search-field"><Search size={19} /><input type="search" aria-label="搜索词库" value={listSearchQuery} onChange={event => onSetListSearchQuery(event.target.value)} placeholder="搜索单词、释义或例句…" /></label>
            <div className="list-filters"><SlidersHorizontal size={16} /><select aria-label="筛选学习阶段" value={listFilterStage} onChange={event => onSetListFilterStage(event.target.value)}><option value="all">所有阶段</option><option value="mastered">已掌握</option>{Array.from({ length: 13 }, (_, i) => <option key={i} value={i}>阶段 {i}</option>)}</select><select aria-label="筛选复习日期" value={listFilterDate} onChange={event => onSetListFilterDate(event.target.value)}><option value="all">所有日期</option><option value="overdue">已逾期</option><option value="today">今天到期</option><option value="tomorrow">明天到期</option><option value="future">未来任务</option></select></div>
        </div>
        <div className="list-summary">{filteredRecords.length} 个词条<span>单词与表达，都值得留住。</span></div>
        <div className="word-list-head"><span>单词 / 释义</span><span>下次复习</span><span>学习模式</span><span>操作</span></div>
        {filteredRecords.map(record => <article className="word-list-row" key={record.id}>
            <button className="word-list-main" onClick={() => onOpenModal(record)} aria-label={`查看 ${record.word} 的详情`}><strong>{record.word}</strong><span>{record.reading}</span><p>{record.customMeaning || record.dictionaryMeaning || record.sentence || '暂无释义'}</p></button>
            <div className="word-list-date"><span className={record.mastered ? 'mastered-label' : ''}>{record.mastered ? '已掌握' : record.nextReviewDate}</span><small>{record.mastered ? '记忆已沉淀' : record.isMasteredReview ? '已掌握复习' : `阶段 ${record.reviewStage}`}</small></div>
            <button className={`mode-button ${record.needsReadingPractice ? 'reinforced' : ''}`} onClick={() => onToggleReadingPractice(record.id)} aria-label={`${record.word}：${record.needsReadingPractice ? '切换为标准模式' : '切换为强化模式'}`}>{record.needsReadingPractice ? <Zap size={14} /> : <BookOpen size={14} />}{record.needsReadingPractice ? '读音强化' : '标准模式'}</button>
            <div className="word-list-actions"><button className="secondary-button" onClick={() => onOpenModal(record)}>详情</button><button className="icon-button delete-button" onClick={() => onDelete(record.id)} aria-label={`删除 ${record.word}`}><Trash2 size={16} /></button></div>
        </article>)}
        {!filteredRecords.length && <div className="empty-state"><Search size={30} /><h3>{listSearchQuery ? '没有找到匹配的词。' : '这里，等着你的第一个词。'}</h3><p>{listSearchQuery ? '换个关键词，或调整筛选条件。' : '从新词录入开始，慢慢积累自己的词库。'}</p></div>}
    </section>;
}
