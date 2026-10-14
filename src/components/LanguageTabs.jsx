export default function LanguageTabs({ filterLang, onChange }) {
    return <div className="language-tabs" role="group" aria-label="筛选语种">{[{ id: 'all', label: '全部' }, { id: 'en', label: '英语' }, { id: 'jp', label: '日语' }, { id: 'other', label: '其他' }].map(tab => <button key={tab.id} aria-pressed={filterLang === tab.id} className={filterLang === tab.id ? 'active' : ''} onClick={() => onChange(tab.id)}>{tab.label}</button>)}</div>;
}
