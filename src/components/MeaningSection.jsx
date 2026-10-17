import { useState } from 'react';
import { BookOpen, Check, Edit3, Sparkles, X } from 'lucide-react';

function MarkdownRenderer({ content }) {
    return <div className="analysis-text">{content.split('\n').filter(line => line.trim()).map((line, index) => <p key={index}>{line.split(/(\*\*.*?\*\*)/g).map((part, i) => part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part)}</p>)}</div>;
}
export default function MeaningSection({ record, onUpdate, compact = false, defaultAnalysisOpen = false }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(record.customMeaning || '');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [analysisOpen, setAnalysisOpen] = useState(defaultAnalysisOpen);
    const save = async () => {
        if (saving) return;
        setSaving(true);
        setError('');
        try {
            const result = await onUpdate({ ...record, customMeaning: draft });
            if (result === false) setError('笔记未保存，请重试。');
            else setEditing(false);
        } catch { setError('笔记未保存，请重试。'); }
        finally { setSaving(false); }
    };
    const analysis = record.aiAnalysis ? <MarkdownRenderer content={record.aiAnalysis} /> : <p className="meaning-empty">暂无 AI 解析，可在词条详情中生成。</p>;
    return <div className="meaning-section">
        {record.dictionaryMeaning && <section className="dictionary-meaning"><h4><BookOpen size={14} />词典释义</h4><p>{record.dictionaryMeaning}</p></section>}
        <section className="personal-meaning"><div className="meaning-heading"><h4><Edit3 size={14} />我的笔记</h4>{!editing && <button onClick={() => { setDraft(record.customMeaning || ''); setEditing(true); }}>{record.customMeaning ? '编辑' : '添加'}</button>}</div>
            {editing ? <div className="meaning-editor"><textarea aria-label="自定义释义" value={draft} onChange={event => setDraft(event.target.value)} placeholder="写下你理解的意思或记忆提示…" rows={2} autoFocus /><div><button className="secondary-button" onClick={() => setEditing(false)} disabled={saving}><X size={14} />取消</button><button className="primary-button" onClick={save} disabled={saving}><Check size={14} />{saving ? '保存中…' : '保存'}</button></div>{error && <p className="form-error" role="alert">{error}</p>}</div> : record.customMeaning ? <p className="personal-meaning-text">{record.customMeaning}</p> : <p className="meaning-empty">留一点自己的理解，下次更容易想起。</p>}
        </section>
        {compact ? <details className="ai-details" open={analysisOpen} onToggle={event => setAnalysisOpen(event.currentTarget.open)}><summary><Sparkles size={14} />AI 解析<span>{analysisOpen ? '收起' : record.aiAnalysis ? '展开' : '暂无'}</span></summary>{analysis}</details> : <section className="ai-meaning"><h4><Sparkles size={14} />AI 解析</h4>{analysis}</section>}
    </div>;
}
