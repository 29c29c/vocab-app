import { KeyRound, Plus, RefreshCw, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { AI_PROVIDER_OPTIONS } from '../shared/aiProviders.js';

const REVIEW_SHORTCUT_FIELDS = [
    { key: 'reviewShortcutForget', label: '忘记', hint: '评分' },
    { key: 'reviewShortcutHard', label: '模糊', hint: '评分' },
    { key: 'reviewShortcutEasy', label: '记得', hint: '评分' }
];

function NumberSetting({ label, value, min, max, onChange }) {
    const [draft, setDraft] = useState(String(value));
    const commit = () => {
        const number = draft.trim() === '' ? value : Number(draft);
        const next = Number.isFinite(number) ? Math.max(min, Math.min(max, Math.trunc(number))) : value;
        setDraft(String(next));
        if (next !== value) onChange(next);
    };
    return <label className="block text-xs text-slate-500">
        {label}
        <input type="number" min={min} max={max} step="1" value={draft}
            onChange={event => setDraft(event.target.value)} onBlur={commit}
            onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }}
            className="w-full mt-2 p-2 rounded bg-white border border-slate-200 text-slate-800 text-base" />
    </label>;
}

export default function SettingsPanel({
    adminStatusChecked,
    apiKeyDraft,
    apiKeySaveMessage,
    apiKeySaveStatus,
    inviteCodeDraft,
    inviteCodeError,
    inviteCodeMutatingId,
    inviteCodes,
    inviteCodesLoading,
    isAdmin,
    isCreatingInviteCode,
    isSavingApiKey,
    onCreateInviteCode,
    onDeleteInviteCode,
    onRefreshInviteCodes,
    onRetrySettings,
    onSaveApiKey,
    onToggleInviteCode,
    onUpdateInviteCodeDraft,
    onUpdateApiKeyDraft,
    onUpdateSetting,
    provider,
    settingsError,
    settingsSaveError,
    settingsSaveStatus,
    settingsStatus,
    reviewShortcutEasy,
    reviewShortcutForget,
    reviewShortcutHard,
    masteredReviewEnabled,
    masteredReviewDailyCount,
    masteredReviewMinDays,
    showReviewSentence
}) {
    const apiKeyStatusClassName = apiKeySaveStatus === 'error'
        ? 'text-red-700 bg-red-500/10 border border-red-300/20'
        : apiKeySaveStatus === 'saved'
            ? 'text-emerald-700 bg-emerald-500/10 border border-emerald-300/20'
            : 'text-slate-500 bg-slate-50 border border-slate-200';
    const shortcutValues = {
        reviewShortcutEasy,
        reviewShortcutForget,
        reviewShortcutHard
    };

    const renderShortcutField = field => (
        <label key={field.key} className="block">
            <div className="text-xs text-slate-500 mb-1">
                {field.label}
                <span className="opacity-70 ml-1">({field.hint})</span>
            </div>
            <input
                type="text"
                value={shortcutValues[field.key] || ''}
                onChange={event => onUpdateSetting(field.key, event.target.value.toUpperCase().slice(0, 1))}
                aria-label={`${field.label}快捷键`} maxLength={1}
                className="w-full p-2 rounded bg-slate-50 border-slate-200 text-slate-800 text-base uppercase tracking-[0.2em]"
                placeholder="-"
            />
        </label>
    );

    return (
        <div className="settings-content space-y-5">
            {settingsStatus === 'loading' && (
                <div className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2" role="status">设置正在加载，复习可以继续使用。</div>
            )}
            {settingsStatus === 'error' && (
                <div className="text-sm text-amber-800 bg-amber-500/10 rounded-lg px-3 py-2 flex items-center justify-between gap-3" role="alert">
                    <span>设置加载失败：{settingsError}。当前使用本账户缓存或默认设置。</span>
                    <button type="button" onClick={onRetrySettings} className="shrink-0 rounded bg-amber-500/30 px-3 py-1">重试</button>
                </div>
            )}
            {settingsSaveStatus === 'saving' && (
                <div className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2" role="status">设置保存中…</div>
            )}
            {settingsSaveStatus === 'error' && (
                <div className="text-sm text-amber-800 bg-amber-500/10 rounded-lg px-3 py-2 flex items-center justify-between gap-3" role="alert">
                    <span>设置尚未保存：{settingsSaveError}</span>
                    <button type="button" onClick={onRetrySettings} className="shrink-0 rounded bg-amber-500/30 px-3 py-1">重试</button>
                </div>
            )}
            <div>
                <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-yellow-300" /> AI 设置
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs text-slate-500">API Key</label>
                        <div className="mt-1 flex gap-2">
                            <input
                                type="password"
                                value={apiKeyDraft}
                                onChange={event => onUpdateApiKeyDraft(event.target.value)}
                                placeholder="输入后点击保存到服务端"
                                aria-label="AI API Key" className="min-w-0 flex-1 p-2 rounded bg-slate-50 border-slate-200 text-slate-800 text-base"
                            />
                            <button
                                onClick={onSaveApiKey}
                                disabled={isSavingApiKey}
                                className="px-4 rounded bg-emerald-500 hover:bg-emerald-600 text-slate-800 font-medium disabled:opacity-50 flex items-center gap-1"
                            >
                                {isSavingApiKey ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                保存
                            </button>
                        </div>
                        {apiKeySaveMessage && <div className={`mt-2 text-xs rounded-lg px-3 py-2 ${apiKeyStatusClassName}`}>
                            {apiKeySaveMessage}
                        </div>}
                    </div>
                    <div>
                        <label className="text-xs text-slate-500">Provider</label>
                        <select
                            value={provider}
                            onChange={event => onUpdateSetting('provider', event.target.value)}
                            aria-label="AI 服务商" className="w-full mt-1 p-2 rounded bg-slate-50 text-slate-800 text-base"
                        >
                            {AI_PROVIDER_OPTIONS.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-between gap-4">
                    <div>
                        <div className="text-sm font-bold text-slate-800">复习显示例句</div>
                        <div className="text-xs text-slate-500 mt-1">
                            普通复习和重点巩固共用这个设置。
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => onUpdateSetting('showReviewSentence', !showReviewSentence)}
                        className={`relative inline-flex h-7 w-14 items-center rounded-full transition ${showReviewSentence ? 'bg-emerald-500' : 'bg-slate-600'}`}
                        aria-label="复习显示例句" aria-pressed={showReviewSentence}
                        title={showReviewSentence ? '已开启' : '已关闭'}
                    >
                        <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${showReviewSentence ? 'translate-x-8' : 'translate-x-1'}`}
                        />
                    </button>
                </div>
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="text-sm font-bold text-slate-800">复习快捷键</div>
                    <div className="text-xs text-slate-500 mt-1">
                        仅用于电脑网页端复习评分。
                    </div>
                    <div className="mt-4">
                        <div className="grid grid-cols-3 gap-3">
                            {REVIEW_SHORTCUT_FIELDS.map(renderShortcutField)}
                        </div>
                    </div>
                </div>
            </div>

            <section className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4" aria-label="已掌握回归复习设置">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h3 className="text-sm font-bold text-slate-800">已掌握回归复习</h3>
                        <p className="text-xs text-slate-500 mt-1">每天北京时间凌晨 4 点，服务器自动随机抽取并加入今日任务，无需打开页面。未完成的词会累积。</p>
                    </div>
                    <button type="button" aria-label="开启已掌握回归复习" aria-pressed={masteredReviewEnabled}
                        onClick={() => onUpdateSetting('masteredReviewEnabled', !masteredReviewEnabled)}
                        className={`relative inline-flex h-7 w-14 shrink-0 items-center rounded-full transition ${masteredReviewEnabled ? 'bg-emerald-500' : 'bg-slate-600'}`}>
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${masteredReviewEnabled ? 'translate-x-8' : 'translate-x-1'}`} />
                    </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <NumberSetting key={`count-${masteredReviewDailyCount}`} label="每日回归数量（个）"
                        value={masteredReviewDailyCount} min={1} max={1000}
                        onChange={value => onUpdateSetting('masteredReviewDailyCount', value)} />
                    <NumberSetting key={`days-${masteredReviewMinDays}`} label="掌握后至少等待（天）"
                        value={masteredReviewMinDays} min={0} max={36500}
                        onChange={value => onUpdateSetting('masteredReviewMinDays', value)} />
                </div>
                <p className="text-xs text-slate-500 mt-3 leading-relaxed">设置在下一次凌晨 4 点抽取时生效。首次点记住即回到已掌握；模糊或忘记则按阶段 7 的规则继续复习，并移除回归标记。关闭只停止后续抽取，已入队的词会保留。</p>
            </section>

            {(isAdmin || inviteCodesLoading || !adminStatusChecked) && (
                <div className="border-t border-slate-200 pt-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-emerald-300" /> 邀请码管理
                        </h3>
                        <button
                            onClick={onRefreshInviteCodes}
                            disabled={inviteCodesLoading}
                            className="text-xs px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 disabled:opacity-50 flex items-center gap-1"
                        >
                            <RefreshCw className={`w-3 h-3 ${inviteCodesLoading ? 'animate-spin' : ''}`} />
                            刷新
                        </button>
                    </div>

                    {!adminStatusChecked && (
                        <div className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                            正在检查管理员权限...
                        </div>
                    )}

                    {inviteCodeError && (
                        <div className="text-sm text-red-700 bg-red-500/10 border border-red-300/20 rounded-lg px-3 py-2">
                            {inviteCodeError}
                        </div>
                    )}

                    {isAdmin && (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_auto] gap-3 items-end">
                                <div>
                                    <label className="text-xs text-slate-500">邀请码</label>
                                    <input
                                        type="text"
                                        value={inviteCodeDraft.code}
                                        onChange={event => onUpdateInviteCodeDraft('code', event.target.value)}
                                        placeholder="例如：spring-2026-admin"
                                        className="w-full mt-1 p-2 rounded bg-slate-50 border-slate-200 text-slate-800 text-base"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500">可用次数</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={inviteCodeDraft.maxUses}
                                        onChange={event => onUpdateInviteCodeDraft('maxUses', event.target.value)}
                                        className="w-full mt-1 p-2 rounded bg-slate-50 border-slate-200 text-slate-800 text-base"
                                    />
                                </div>
                                <button
                                    onClick={onCreateInviteCode}
                                    disabled={isCreatingInviteCode}
                                    className="h-10 px-4 rounded bg-emerald-500 hover:bg-emerald-600 text-slate-800 font-medium disabled:opacity-50 flex items-center justify-center gap-1"
                                >
                                    {isCreatingInviteCode ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                    新增
                                </button>
                            </div>

                            <div className="space-y-2">
                                {inviteCodesLoading && (
                                    <div className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                                        正在加载邀请码...
                                    </div>
                                )}

                                {!inviteCodesLoading && inviteCodes.length === 0 && (
                                    <div className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                                        当前还没有邀请码，先创建一个吧。
                                    </div>
                                )}

                                {inviteCodes.map(inviteCode => (
                                    <div key={inviteCode.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-mono text-sm text-slate-800 break-all">{inviteCode.code}</span>
                                                <span className={`text-[11px] px-2 py-0.5 rounded-full ${inviteCode.isActive ? 'bg-emerald-500/20 text-emerald-700' : 'bg-slate-500/20 text-slate-300'}`}>
                                                    {inviteCode.isActive ? '启用中' : '已停用'}
                                                </span>
                                            </div>
                                            <div className="text-xs text-slate-500 mt-1">
                                                已使用 {inviteCode.usedCount} / {inviteCode.maxUses}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => onToggleInviteCode(inviteCode)}
                                                disabled={inviteCodeMutatingId === inviteCode.id}
                                                className="text-xs px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 disabled:opacity-50"
                                            >
                                                {inviteCodeMutatingId === inviteCode.id ? '处理中...' : inviteCode.isActive ? '停用' : '启用'}
                                            </button>
                                            <button
                                                onClick={() => onDeleteInviteCode(inviteCode.id)}
                                                disabled={inviteCodeMutatingId === inviteCode.id}
                                                className="text-xs px-3 py-1.5 rounded bg-red-500/20 hover:bg-red-500/30 text-red-700 disabled:opacity-50 flex items-center gap-1"
                                            >
                                                <Trash2 className="w-3 h-3" /> 删除
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
