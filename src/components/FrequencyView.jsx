import { FileSpreadsheet } from 'lucide-react';
import LanguageTabs from './LanguageTabs.jsx';
export default function FrequencyView({ filterLang, frequencyData, onExportFrequencyExcel, onOpenModal, onSetFilterLang }) {
    return <section className="frequency-page">
        <div className="collection-toolbar"><LanguageTabs filterLang={filterLang} onChange={onSetFilterLang} /><button className="secondary-button" onClick={onExportFrequencyExcel}><FileSpreadsheet size={16} />导出 Excel</button></div>
        <p className="collection-summary">{frequencyData.length} 个不同的词 · 按词库中的记录次数排序</p>
        {!frequencyData.length ? <div className="empty-state"><h3>这个语种还没有记录。</h3><p>录入新词，或切换语种看看。</p></div> : <div className="frequency-list">{frequencyData.map((item, index) => <article className="frequency-row" key={item.word}>
            <span className="frequency-rank">{String(index + 1).padStart(2, '0')}</span><div className="frequency-word"><h2>{item.word}</h2><p>{item.details[item.ids[0]]?.customMeaning || item.details[item.ids[0]]?.dictionaryMeaning || '查看记录中的语境'}</p></div><span className="frequency-count">{item.count}<small>次记录</small></span>
            <div className="frequency-links">{item.ids.map((id, i) => <button onClick={() => onOpenModal(item.details[id])} key={id} aria-label={`查看 ${item.word} 第 ${i + 1} 次记录`}>{item.ids.length > 1 ? `记录 ${i + 1}` : '查看语境'}</button>)}</div>
        </article>)}</div>}
    </section>;
}
