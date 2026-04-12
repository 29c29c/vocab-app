import {
    BarChart2,
    BookOpen,
    Calendar,
    FileText,
    Layers,
    LogOut,
    PenTool,
    Plus,
    Repeat,
    Settings,
    Upload,
    Zap
} from 'lucide-react';
import SettingsPanel from './SettingsPanel.jsx';

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
    adminStatusChecked,
    onCreateInviteCode,
    onDeleteInviteCode,
    onRefreshInviteCodes,
    onSaveApiKey,
    onSetView,
    onToggleInviteCode,
    onUpdateInviteCodeDraft,
    onUpdateApiKeyDraft,
    provider,
    recordsCount,
    reviewShortcutEasy,
    reviewShortcutForget,
    reviewShortcutHard,
    reviewQueueLength,
    saveStatus,
    showSettings,
    showReviewSentence,
    onToggleSettings,
    onUpdateSetting,
    view
}) {
    const mainNavItems = [
        { id: 'input', label: '录入', icon: Plus },
        { id: 'review', label: '复习', icon: Repeat },
        { id: 'list', label: '列表', icon: BookOpen },
        { id: 'frequency', label: '词频', icon: BarChart2 },
        { id: 'date', label: '日期', icon: Calendar }
    ];

    const toolNavItems = [
        { id: 'article', title: '文章识别', icon: FileText },
        { id: 'writing', title: '写作进阶', icon: PenTool }
    ];

    return (
        <header className="bg-gradient-to-r from-indigo-700 to-purple-700 text-white shadow-lg sticky top-0 z-50 pt-[env(safe-area-inset-top)] backdrop-blur-md">
            <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 p-4">
                <div className="flex items-center gap-3">
                    <Layers className="w-8 h-8 text-yellow-300" />
                    <div>
                        <h1 className="text-xl font-bold tracking-tight">
                            记忆飞船 <span className="opacity-80 font-normal text-xs bg-white/20 px-2 py-0.5 rounded">V7.0 Beta</span>
                        </h1>
                        <div className="text-xs opacity-70 flex gap-2">
                            <span>{saveStatus === 'saving' ? '云端同步中...' : `已存 ${recordsCount} 条`}</span>
                            <span>|</span>
                            <span>用户: {currentUser}</span>
                        </div>
                    </div>
                </div>
                <div className="w-full md:w-auto overflow-x-auto no-scrollbar mask-gradient-to-r">
                    <div className="flex items-center gap-3 min-w-max mx-auto md:mx-0 px-1 justify-center md:justify-end">
                        <nav className="flex bg-white/10 backdrop-blur-sm rounded-lg p-1">
                            {mainNavItems.map(item => {
                                const Icon = item.icon;
                                const isActive = view === item.id;
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => onSetView(item.id)}
                                        className={`px-3 py-2 rounded text-sm flex items-center gap-2 whitespace-nowrap transition relative ${isActive ? 'bg-white text-indigo-700 shadow' : 'hover:bg-white/10'}`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        {item.label}
                                        {item.id === 'review' && reviewQueueLength > 0 && (
                                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full">
                                                {reviewQueueLength}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </nav>
                        <div className="flex items-center shrink-0">
                            <button onClick={handleImportClick} className="p-2 rounded-full hover:bg-white/20" title="导入 Excel">
                                <Upload className="w-5 h-5" />
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    accept=".xlsx, .xls"
                                    className="hidden"
                                />
                            </button>
                            {toolNavItems.map(item => {
                                const Icon = item.icon;
                                const isActive = view === item.id;
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => onSetView(item.id)}
                                        className={`p-2 rounded-full ${isActive ? 'bg-white text-indigo-700 shadow' : 'hover:bg-white/20'}`}
                                        title={item.title}
                                    >
                                        <Icon className="w-5 h-5" />
                                    </button>
                                );
                            })}
                            <button
                                onClick={handleBatchAnalyze}
                                disabled={isBatchAnalyzing}
                                className={`p-2 rounded-full ${isBatchAnalyzing ? 'bg-indigo-500 animate-pulse' : 'hover:bg-white/20'}`}
                                title="批量解析"
                            >
                                <Zap className={`w-5 h-5 ${isBatchAnalyzing ? 'fill-yellow-300 text-yellow-300' : ''}`} />
                            </button>
                            <button onClick={onToggleSettings} className="p-2 rounded-full hover:bg-white/20">
                                <Settings className="w-5 h-5" />
                            </button>
                            <button
                                onClick={handleLogout}
                                className="p-2 rounded-full hover:bg-red-500/50 text-white/80 hover:text-white transition"
                                title="退出登录"
                            >
                                <LogOut className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            {showSettings && (
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
                    onSaveApiKey={onSaveApiKey}
                    onToggleInviteCode={onToggleInviteCode}
                    onUpdateInviteCodeDraft={onUpdateInviteCodeDraft}
                    onUpdateApiKeyDraft={onUpdateApiKeyDraft}
                    onUpdateSetting={onUpdateSetting}
                    provider={provider}
                    reviewShortcutEasy={reviewShortcutEasy}
                    reviewShortcutForget={reviewShortcutForget}
                    reviewShortcutHard={reviewShortcutHard}
                    showReviewSentence={showReviewSentence}
                />
            )}
        </header>
    );
}
