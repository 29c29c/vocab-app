import { lazy, Suspense } from 'react';
import { Sparkles } from 'lucide-react';
import useVocabularyApp from './hooks/useVocabularyApp.js';
import AppHeader from './components/AppHeader.jsx';
import WorkspaceHeading from './components/WorkspaceHeading.jsx';
import Dialog from './components/Dialog.jsx';
import AuthScreen from './components/AuthScreen.jsx';
import DateArchiveView from './components/DateArchiveView.jsx';
import FrequencyView from './components/FrequencyView.jsx';
import InputView from './components/InputView.jsx';
import ListView from './components/ListView.jsx';
import MeaningSection from './components/MeaningSection.jsx';
import ReviewView from './components/ReviewView.jsx';

const ArticleAnalyzer = lazy(() => import('./components/ArticleAnalyzer.jsx'));
const WritingPolisher = lazy(() => import('./components/WritingPolisher.jsx'));

const DICTATION_SCOPE_OPTIONS = [
    { key: 'new', label: '新词', note: '按录入日期' },
    { key: 'review', label: '常规', note: '按复习日期' },
    { key: 'focus', label: '重点', note: '按复习日期' }
];

export default function SmartVocabularyApp() {
    const {
        token,
        currentUser,
        isLoggingOut,
        records,
        view,
        setView,
        reviewTab,
        setReviewTab,
        filterLang,
        setFilterLang,
        listFilterStage,
        setListFilterStage,
        listFilterDate,
        setListFilterDate,
        listSearchQuery,
        setListSearchQuery,
        isDataLoaded,
        dataStatus,
        recordCount,
        dataError,
        pendingCount,
        activeWriteCount,
        directWriteError,
        setDirectWriteError,
        actionError,
        setActionError,
        effectiveSaveStatus,
        effectiveSaveError,
        inputSaveStatus,
        conflictId,
        isBatchAnalyzing,
        showDictationModal,
        setShowDictationModal,
        dictationDate,
        setDictationDate,
        dictationScope,
        setDictationScope,
        modalRecord,
        setModalRecord,
        inputDate,
        setInputDate,
        inputWord,
        setInputWord,
        inputSentence,
        setInputSentence,
        inputMeaning,
        setInputMeaning,
        lookupPanelState,
        reviewQueue,
        reviewHistory,
        isFlipped,
        setIsFlipped,
        isReviewBusy,
        showSettings,
        setShowSettings,
        settingsStatus,
        settingsError,
        settingsSaveStatus,
        settingsSaveError,
        fileInputRef,
        settings,
        apiKeyDraft,
        apiKeySaveStatus,
        apiKeySaveMessage,
        isSavingApiKey,
        isAdmin,
        adminStatusChecked,
        inviteCodes,
        inviteCodesLoading,
        inviteCodeError,
        inviteCodeDraft,
        inviteCodeMutatingId,
        isCreatingInviteCode,
        recordSyncRef,
        provider,
        handleLogin,
        handleUserLogout,
        requestAiPrompt,
        updateSetting,
        retrySettings,
        updateInviteCodeDraft,
        updateApiKeyDraft,
        handleSaveApiKey,
        loadInviteCodes,
        handleCreateInviteCode,
        handleToggleInviteCode,
        handleDeleteInviteCode,
        handleAddRecord,
        updateRecord,
        handleDelete,
        handleBatchAddRecords,
        mainDueRecords,
        focusDueRecords,
        focusBoardRecords,
        recentManualEntries,
        latestLookupRecord,
        latestLookupState,
        currentReviewItem,
        currentQuestionType,
        handleReviewResult,
        handleUndoReview,
        handleMaster,
        handleResurrect,
        toggleReadingPractice,
        callAIAnalysis,
        handleBatchAnalyze,
        playTTS,
        handleImportClick,
        handleFileChange,
        listViewRecords,
        frequencyData,
        dateGroupedData,
        exportFrequencyExcel,
        exportDateArchiveExcel,
        generateDictationSheet
    } = useVocabularyApp();

    // 如果未登录，显示登录页
    if (!token) {
        return <AuthScreen onLogin={handleLogin} />;
    }

    // 主界面 - 增加 pb-[env(safe-area-inset-bottom)] 适配 iPhone 底部
    return (
        <div className={`app-shell view-${view}`}>
            <AppHeader
                adminStatusChecked={adminStatusChecked}
                apiKeyDraft={apiKeyDraft}
                apiKeySaveMessage={apiKeySaveMessage}
                apiKeySaveStatus={apiKeySaveStatus}
                currentUser={currentUser}
                fileInputRef={fileInputRef}
                handleBatchAnalyze={handleBatchAnalyze}
                handleFileChange={handleFileChange}
                handleImportClick={handleImportClick}
                handleLogout={handleUserLogout}
                inviteCodeDraft={inviteCodeDraft}
                inviteCodeError={inviteCodeError}
                inviteCodeMutatingId={inviteCodeMutatingId}
                inviteCodes={inviteCodes}
                inviteCodesLoading={inviteCodesLoading}
                isAdmin={isAdmin}
                isCreatingInviteCode={isCreatingInviteCode}
                isBatchAnalyzing={isBatchAnalyzing}
                isSavingApiKey={isSavingApiKey}
                isLoggingOut={isLoggingOut}
                onCreateInviteCode={handleCreateInviteCode}
                onDeleteInviteCode={handleDeleteInviteCode}
                onRefreshInviteCodes={loadInviteCodes}
                onSaveApiKey={handleSaveApiKey}
                onSetView={setView}
                onToggleInviteCode={handleToggleInviteCode}
                onToggleSettings={() => setShowSettings(previous => !previous)}
                onUpdateApiKeyDraft={updateApiKeyDraft}
                onUpdateInviteCodeDraft={updateInviteCodeDraft}
                onUpdateSetting={updateSetting}
                settingsStatus={settingsStatus}
                settingsError={settingsError}
                settingsSaveStatus={settingsSaveStatus}
                settingsSaveError={settingsSaveError}
                onRetrySettings={retrySettings}
                provider={provider}
                recordsCount={recordCount}
                dataStatus={dataStatus}
                pendingCount={pendingCount}
                saveError={effectiveSaveError}
                activeWriteCount={activeWriteCount}
                reviewShortcutEasy={settings.reviewShortcutEasy}
                reviewShortcutForget={settings.reviewShortcutForget}
                reviewShortcutHard={settings.reviewShortcutHard}
                reviewQueueLength={mainDueRecords.length + focusDueRecords.length}
                saveStatus={effectiveSaveStatus}
                showSettings={showSettings}
                showReviewSentence={settings.showReviewSentence}
                view={view}
            />

            <main id="main-content" className="app-main">
                {view !== 'review' && <WorkspaceHeading view={view} />}
                {(dataStatus === 'cached' || dataStatus === 'partial' || dataStatus === 'error' || effectiveSaveStatus === 'error' || effectiveSaveStatus === 'conflict' || actionError) && (
                    <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="status">
                        <div>{dataStatus === 'cached' ? '正在使用本地数据，服务器核对尚未完成。' : dataStatus === 'partial' ? `复习数据已就绪，完整单词列表仍在加载。${dataError ? `加载失败：${dataError}` : ''}` : dataStatus === 'error' ? `单词加载失败：${dataError}` : ''}</div>
                        {effectiveSaveError && <div>{effectiveSaveError}</div>}
                        {actionError && <div>{actionError} <button type="button" onClick={() => setActionError('')} className="underline">关闭提示</button></div>}
                        {directWriteError && (
                            <button type="button" onClick={() => setDirectWriteError('')} className="mt-1 underline">已核对服务器记录，关闭提示</button>
                        )}
                        {pendingCount > 0 && <div>还有 {pendingCount} 次操作未获服务器确认；显示「已保存」前请勿清除浏览器数据。</div>}
                        <div className="mt-2 flex flex-wrap gap-2">
                            <button type="button" onClick={() => recordSyncRef.current?.retry()} className="rounded bg-amber-200 px-3 py-1">重新连接</button>
                            {conflictId && (
                                <>
                                    <button type="button" onClick={() => recordSyncRef.current?.resolveConflict(true)} className="rounded bg-amber-200 px-3 py-1">用本地进度覆盖服务器</button>
                                    <button type="button" onClick={() => recordSyncRef.current?.resolveConflict(false)} className="rounded border border-amber-400 px-3 py-1">放弃本地进度，使用服务器</button>
                                </>
                            )}
                        </div>
                    </div>
                )}

                <Suspense fallback={<div className="empty-state" role="status">正在准备学习工具…</div>}>
                {view === 'writing' && (
                    <WritingPolisher
                        settings={settings}
                        requestAiPrompt={requestAiPrompt}
                        onAddWords={items => handleBatchAddRecords(items, 'writing')}
                        onCancel={() => setView('input')}
                    />
                )}

                {view === 'article' && (
                    <ArticleAnalyzer
                        settings={settings}
                        requestAiPrompt={requestAiPrompt}
                        onAddWords={items => handleBatchAddRecords(items, 'article')}
                        onCancel={() => setView('input')}
                    />
                )}

                </Suspense>

                {view === 'input' && (
                    <InputView
                        inputDate={inputDate}
                        inputMeaning={inputMeaning}
                        inputSentence={inputSentence}
                        inputWord={inputWord}
                        latestLookupRecord={latestLookupRecord}
                        latestLookupState={latestLookupState}
                        lookupPanelState={lookupPanelState}
                        onInputDateChange={setInputDate}
                        onInputMeaningChange={setInputMeaning}
                        onInputSentenceChange={setInputSentence}
                        onInputWordChange={setInputWord}
                        onSubmit={handleAddRecord}
                        recentManualEntries={recentManualEntries}
                        saveStatus={inputSaveStatus}
                    />
                )}

                {view === 'review' && !isDataLoaded && (
                    <div className="rounded-xl bg-white p-8 text-center" role="status">
                        {dataStatus === 'error' ? '单词加载失败，请重新连接后再复习。' : '正在加载单词与复习队列…'}
                    </div>
                )}
                {view === 'review' && isDataLoaded && (
                    <ReviewView
                        currentQuestionType={currentQuestionType}
                        currentReviewItem={currentReviewItem}
                        focusBoardRecords={focusBoardRecords}
                        focusQueueCount={focusDueRecords.length}
                        handleMaster={handleMaster}
                        handleReviewResult={handleReviewResult}
                        handleUndoReview={handleUndoReview}
                        isFlipped={isFlipped}
                        isReviewBusy={isReviewBusy}
                        onSetView={setView}
                        reviewShortcutEasy={settings.reviewShortcutEasy}
                        reviewShortcutForget={settings.reviewShortcutForget}
                        reviewShortcutHard={settings.reviewShortcutHard}
                        isPartial={dataStatus === 'partial'}
                        mainQueueCount={mainDueRecords.length}
                        onResurrect={handleResurrect}
                        playTTS={playTTS}
                        records={records}
                        reviewHistory={reviewHistory}
                        reviewQueue={reviewQueue}
                        reviewTab={reviewTab}
                        showReviewSentence={settings.showReviewSentence}
                        setIsFlipped={setIsFlipped}
                        setReviewTab={setReviewTab}
                        updateRecord={updateRecord}
                    />
                )}

                {['list', 'frequency', 'date'].includes(view) && (!isDataLoaded || dataStatus === 'partial') && (
                    <div className="rounded-xl bg-white p-8 text-center" role="status">
                        {dataStatus === 'error' ? '完整单词列表加载失败，请重新连接。' : '完整单词列表加载完成后即可查看此页面。'}
                    </div>
                )}

                {view === 'list' && isDataLoaded && dataStatus !== 'partial' && (
                    <ListView
                        filteredRecords={listViewRecords}
                        listFilterDate={listFilterDate}
                        listSearchQuery={listSearchQuery}
                        listFilterStage={listFilterStage}
                        onDelete={handleDelete}
                        onOpenModal={setModalRecord}
                        onSetListFilterDate={setListFilterDate}
                        onSetListSearchQuery={setListSearchQuery}
                        onSetListFilterStage={setListFilterStage}
                        onToggleReadingPractice={toggleReadingPractice}
                    />
                )}

                {view === 'frequency' && isDataLoaded && dataStatus !== 'partial' && (
                    <FrequencyView
                        filterLang={filterLang}
                        frequencyData={frequencyData}
                        onExportFrequencyExcel={exportFrequencyExcel}
                        onOpenModal={setModalRecord}
                        onSetFilterLang={setFilterLang}
                    />
                )}

                {view === 'date' && isDataLoaded && dataStatus !== 'partial' && (
                    <DateArchiveView
                        dateGroupedData={dateGroupedData}
                        filterLang={filterLang}
                        onDelete={handleDelete}
                        onExportDateArchiveExcel={exportDateArchiveExcel}
                        onOpenModal={setModalRecord}
                        onSetFilterLang={setFilterLang}
                        onShowDictationModal={() => setShowDictationModal(true)}
                    />
                )}
            </main>

            {/* Modal 弹窗 - 提升 z-index 到 100 以确保在 header 之上 */}
            {modalRecord && (
                <Dialog title={modalRecord.word} onClose={() => setModalRecord(null)} className="word-dialog">
                    <div className="word-detail">
                        <div className="detail-reading">{modalRecord.reading}<button className="sound-button" onClick={() => playTTS(modalRecord.word)} aria-label="播放单词发音">播放发音</button></div>
                        <div className="p-6 overflow-y-auto custom-scrollbar">
                            <div className="bg-slate-50 p-4 rounded-xl border mb-6 relative"><span className="absolute top-2 left-2 text-4xl text-indigo-100 font-serif leading-none">“</span><p className="text-lg font-serif text-slate-700 relative z-10 px-4">{modalRecord.sentence || "暂无例句"}</p></div>
                            <MeaningSection key={`${modalRecord.id}:${modalRecord.revision}:${modalRecord.clientMutationId || ''}`} record={modalRecord} onUpdate={updateRecord} />
                            <div className="mt-6 flex justify-end">
                                {!modalRecord.aiAnalysis && (
                                    <button onClick={() => callAIAnalysis(modalRecord)} className="text-sm text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded hover:bg-indigo-50 flex items-center gap-1"><Sparkles className="w-3 h-3" /> 生成 AI 解析</button>
                                )}
                            </div>
                        </div>
                    </div>
                </Dialog>
            )}

            {/* 听写纸模态框 - z-index 100 */}
            {showDictationModal && (
                <Dialog title="生成听写测试" onClose={() => setShowDictationModal(false)} className="dictation-dialog">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">

                        <p className="text-sm text-slate-500 mb-4">请选择日期：</p>
                        <input type="date" value={dictationDate} onChange={e => setDictationDate(e.target.value)} className="w-full p-3 bg-slate-50 border rounded-xl mb-6 outline-none focus:ring-2 ring-indigo-500 text-base" />
                        <div className="grid grid-cols-3 gap-2 mb-6">
                            {DICTATION_SCOPE_OPTIONS.map(option => {
                                const active = dictationScope === option.key;
                                return (
                                    <button
                                        key={option.key}
                                        onClick={() => setDictationScope(option.key)}
                                        className={`rounded-xl border px-3 py-3 text-left transition ${active ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                                    >
                                        <div className="text-sm font-bold">{option.label}</div>
                                        <div className="text-[11px] mt-1 opacity-80">{option.note}</div>
                                    </button>
                                );
                            })}
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setShowDictationModal(false)} className="flex-1 py-2 rounded-lg bg-slate-100 text-slate-600 font-medium">取消</button>
                            <button onClick={() => { generateDictationSheet(); setShowDictationModal(false); }} className="flex-1 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700">生成试卷</button>
                        </div>
                    </div>
                </Dialog>
            )}
        </div>
    );
}
