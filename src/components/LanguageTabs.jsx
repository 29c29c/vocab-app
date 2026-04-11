export default function LanguageTabs({ filterLang, onChange }) {
    const tabs = [
        { id: 'all', label: '全部' },
        { id: 'en', label: '英语' },
        { id: 'jp', label: '日语' },
        { id: 'other', label: '其他' }
    ];

    return (
        <div className="flex bg-slate-100 p-1 rounded-lg mb-4 w-fit">
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    onClick={() => onChange(tab.id)}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${filterLang === tab.id ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
}
