import { useState } from 'react';
import { BarChart2, BookOpen, Calendar, Check, ChevronRight, Cloud, FileText, LayoutGrid, LogOut, PenTool, Plus, Repeat, Settings, Upload, Zap } from 'lucide-react';
import SettingsPanel from './SettingsPanel.jsx';
import Dialog from './Dialog.jsx';
import { VIEW_TITLES } from './workspaceTitles.js';

export default function AppHeader({
    apiKeyDraft,
    apiKeySaveMessage,
    apiKeySaveStatus,
    currentUser,
    fileInputRef,
    handleBatchAnalyze,
    handleFileChange,
    handleImportClick,
    handleLogout,
    inviteCodeDraft,
    inviteCodeError,
    inviteCodeMutatingId,
    inviteCodes,
    inviteCodesLoading,
    isAdmin,
    isCreatingInviteCode,
    isBatchAnalyzing,
    isSavingApiKey,
    isLoggingOut,
    adminStatusChecked,
    onCreateInviteCode,
    onDeleteInviteCode,
    onRefreshInviteCodes,
    onRetrySettings,
    onSaveApiKey,
    onSetView,
    onToggleInviteCode,
    onUpdateInviteCodeDraft,
    onUpdateApiKeyDraft,
    provider,
    recordsCount,
    dataStatus,
    pendingCount,
    activeWriteCount,
    saveError,
    reviewShortcutEasy,
    reviewShortcutForget,
    reviewShortcutHard,
    reviewQueueLength,
    saveStatus,
    settingsError,
    settingsSaveError,
    settingsSaveStatus,
    settingsStatus,
    showSettings,
    showReviewSentence,
    onToggleSettings,
    onUpdateSetting,
    view
}) {
    const [toolsOpen, setToolsOpen] = useState(false);
    const navItems = [
        { id: 'review', label: '今日复习', icon: Repeat },
        { id: 'list', label: '我的词库', icon: BookOpen },
        { id: 'input', label: '新词录入', icon: Plus },
        { id: 'frequency', label: '词频统计', icon: BarChart2 },
        { id: 'date', label: '日期归档', icon: Calendar }
    ];
    const toolItems = [
        { id: 'article', label: '阅读提词', note: '从文章中提取单词与表达', icon: FileText },
        { id: 'writing', label: '写作润色', note: '修改草稿，收藏地道表达', icon: PenTool }
    ];
    const selectView = id => { onSetView(id); setToolsOpen(false); };
    const saveText = saveStatus === 'saved' ? '已保存到服务器'
        : saveStatus === 'saving' ? `${pendingCount + activeWriteCount} 项待同步`
            : saveStatus === 'conflict' ? '同步冲突，需处理' : '同步失败';
    const countText = dataStatus === 'loading' || dataStatus === 'idle' ? '正在加载词库'
        : dataStatus === 'error' ? '词库加载失败'
            : recordsCount === null ? '复习数据已就绪' : `${recordsCount} 个词条${dataStatus === 'cached' ? ' · 本地待核对' : dataStatus === 'partial' ? ' · 复习先行' : ''}`;
    const renderNav = item => {
        const Icon = item.icon;
        return <button key={item.id} onClick={() => selectView(item.id)} className={`sidebar-link ${view === item.id ? 'active' : ''}`} aria-current={view === item.id ? 'page' : undefined}>
            <Icon size={19} strokeWidth={1.8} /><span>{item.label}</span>
            {item.id === 'review' && reviewQueueLength > 0 && <span className="nav-count">{reviewQueueLength}</span>}
        </button>;
    };
    return (
        <>
            <a className="skip-link" href="#main-content">跳到主要内容</a>
            <aside className="app-sidebar" aria-label="主要导航">
                <button className="brand" onClick={() => selectView('review')} aria-label="记忆飞船首页"><BookOpen size={31} strokeWidth={1.6} /><span>记忆飞船</span></button>
                <nav className="sidebar-nav">{navItems.map(renderNav)}</nav>
                <div className="sidebar-separator" />
                <nav className="sidebar-nav" aria-label="学习工具">
                    {toolItems.map(renderNav)}
                    <button className="sidebar-link" onClick={handleImportClick}><Upload size={19} strokeWidth={1.8} /><span>导入 Excel</span></button>
                    <button className="sidebar-link" onClick={handleBatchAnalyze} disabled={isBatchAnalyzing}><Zap size={19} strokeWidth={1.8} /><span>{isBatchAnalyzing ? '正在解析…' : '批量 AI 解析'}</span></button>
                </nav>
                <div className="sidebar-bottom">
                    <p className="library-count">{countText}</p>
                    <button className="sidebar-link" onClick={onToggleSettings}><Settings size={19} strokeWidth={1.8} /><span>设置</span></button>
                    <div className="user-row"><span className="user-avatar">{currentUser?.slice(0, 1).toUpperCase()}</span><span className="user-name">{currentUser}</span><button className="icon-button" onClick={handleLogout} disabled={isLoggingOut} aria-label="退出登录" title="退出登录"><LogOut size={17} /></button></div>
                </div>
            </aside>
            <header className="workspace-bar">
                <div className="mobile-brand"><BookOpen size={27} strokeWidth={1.6} /><span>记忆飞船</span></div>
                <span className="workspace-bar-title">{VIEW_TITLES[view]}</span>
                <div className={`sync-status ${saveStatus !== 'saved' ? 'sync-pending' : ''}`} role="status" title={saveError || countText}>
                    {saveStatus === 'saved' ? <Check size={15} /> : <Cloud size={15} />}<span>{saveText}</span>
                </div>
                <button className="icon-button mobile-settings" onClick={onToggleSettings} aria-label="设置"><Settings size={21} /></button>
            </header>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".xlsx, .xls" hidden />
            <nav className="mobile-nav" aria-label="底部导航">
                {[{ id: 'review', label: '复习', icon: Repeat }, { id: 'list', label: '词库', icon: BookOpen }, { id: 'input', label: '录入', icon: Plus }].map(item => {
                    const Icon = item.icon;
                    return <button key={item.id} onClick={() => selectView(item.id)} className={view === item.id ? 'active' : ''} aria-current={view === item.id ? 'page' : undefined}><Icon size={21} strokeWidth={1.8} /><span>{item.label}</span></button>;
                })}
                <button onClick={() => setToolsOpen(true)} className={['article', 'writing', 'frequency', 'date'].includes(view) || toolsOpen ? 'active' : ''} aria-label="学习工具"><LayoutGrid size={21} strokeWidth={1.8} /><span>工具</span></button>
            </nav>
            {toolsOpen && <Dialog title="学习工具" onClose={() => setToolsOpen(false)} className="tools-dialog">
                {[...toolItems, ...navItems.filter(item => ['frequency', 'date'].includes(item.id))].map(item => {
                    const Icon = item.icon;
                    return <button className="tool-link" key={item.id} onClick={() => selectView(item.id)}><Icon size={22} /><span><strong>{item.label}</strong>{item.note && <small>{item.note}</small>}</span><ChevronRight size={17} /></button>;
                })}
                <button className="tool-link" onClick={() => { setToolsOpen(false); handleImportClick(); }}><Upload size={22} /><span><strong>导入 Excel</strong><small>批量添加你的词表</small></span><ChevronRight size={17} /></button>
                <button className="tool-link" onClick={() => { setToolsOpen(false); handleBatchAnalyze(); }} disabled={isBatchAnalyzing}><Zap size={22} /><span><strong>{isBatchAnalyzing ? '正在解析…' : '批量 AI 解析'}</strong></span><ChevronRight size={17} /></button>
                <div className="tools-account"><span>{currentUser} · {countText}</span><button onClick={handleLogout} disabled={isLoggingOut}>退出登录</button></div>
            </Dialog>}
            {showSettings && <Dialog title="设置" onClose={onToggleSettings} className="settings-dialog">
                <SettingsPanel
                    adminStatusChecked={adminStatusChecked}
                    apiKeyDraft={apiKeyDraft}
                    apiKeySaveMessage={apiKeySaveMessage}
                    apiKeySaveStatus={apiKeySaveStatus}
                    inviteCodeDraft={inviteCodeDraft}
                    inviteCodeError={inviteCodeError}
                    inviteCodeMutatingId={inviteCodeMutatingId}
                    inviteCodes={inviteCodes}
                    inviteCodesLoading={inviteCodesLoading}
                    isAdmin={isAdmin}
                    isCreatingInviteCode={isCreatingInviteCode}
                    isSavingApiKey={isSavingApiKey}
                    onCreateInviteCode={onCreateInviteCode}
                    onDeleteInviteCode={onDeleteInviteCode}
                    onRefreshInviteCodes={onRefreshInviteCodes}
                    onRetrySettings={onRetrySettings}
                    onSaveApiKey={onSaveApiKey}
                    onToggleInviteCode={onToggleInviteCode}
                    onUpdateInviteCodeDraft={onUpdateInviteCodeDraft}
                    onUpdateApiKeyDraft={onUpdateApiKeyDraft}
                    onUpdateSetting={onUpdateSetting}
                    provider={provider}
                    settingsError={settingsError}
                    settingsSaveError={settingsSaveError}
                    settingsSaveStatus={settingsSaveStatus}
                    settingsStatus={settingsStatus}
                    reviewShortcutEasy={reviewShortcutEasy}
                    reviewShortcutForget={reviewShortcutForget}
                    reviewShortcutHard={reviewShortcutHard}
                    showReviewSentence={showReviewSentence}
                />

            </Dialog>}
        </>
    );
}
