import { KeyRound, Plus, RefreshCw, Save, ShieldCheck, Trash2 } from 'lucide-react';

import { AI_PROVIDER_OPTIONS } from '../shared/aiProviders.js';

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
    onSaveApiKey,
    onToggleInviteCode,
    onUpdateInviteCodeDraft,
    onUpdateApiKeyDraft,
    onUpdateSetting,
    provider
}) {
    const apiKeyStatusClassName = apiKeySaveStatus === 'error'
        ? 'text-red-200 bg-red-500/10 border border-red-300/20'
        : apiKeySaveStatus === 'saved'
            ? 'text-emerald-200 bg-emerald-500/10 border border-emerald-300/20'
            : 'text-indigo-100/80 bg-white/5 border border-white/10';

    return (
        <div className="max-w-5xl mx-auto mt-4 p-4 bg-black/20 rounded-xl backdrop-blur border border-white/10 animate-in slide-in-from-top-2 space-y-5">
            <div>
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-yellow-300" /> AI 设置
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs text-indigo-200">API Key</label>
                        <div className="mt-1 flex gap-2">
                            <input
                                type="password"
                                value={apiKeyDraft}
                                onChange={event => onUpdateApiKeyDraft(event.target.value)}
                                placeholder="输入后点击保存到服务端"
                                className="flex-1 p-2 rounded bg-black/30 border-white/20 text-white text-base"
                            />
                            <button
                                onClick={onSaveApiKey}
                                disabled={isSavingApiKey}
                                className="px-4 rounded bg-emerald-500 hover:bg-emerald-600 text-white font-medium disabled:opacity-50 flex items-center gap-1"
                            >
                                {isSavingApiKey ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                保存
                            </button>
                        </div>
                        <div className={`mt-2 text-xs rounded-lg px-3 py-2 ${apiKeyStatusClassName}`}>
                            {apiKeySaveMessage || 'API Key 仅保存到服务端，不写入当前浏览器本地缓存。'}
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-indigo-200">Provider</label>
                        <select
                            value={provider}
                            onChange={event => onUpdateSetting('provider', event.target.value)}
                            className="w-full mt-1 p-2 rounded bg-black/30 text-white text-base"
                        >
                            {AI_PROVIDER_OPTIONS.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        <div className="mt-2 text-xs text-indigo-100/80 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                            当前预设会自动切换对应的官方接口与默认模型。
                        </div>
                    </div>
                </div>
            </div>

            {(isAdmin || inviteCodesLoading || !adminStatusChecked) && (
                <div className="border-t border-white/10 pt-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-emerald-300" /> 邀请码管理
                        </h3>
                        <button
                            onClick={onRefreshInviteCodes}
                            disabled={inviteCodesLoading}
                            className="text-xs px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-white disabled:opacity-50 flex items-center gap-1"
                        >
                            <RefreshCw className={`w-3 h-3 ${inviteCodesLoading ? 'animate-spin' : ''}`} />
                            刷新
                        </button>
                    </div>

                    {!adminStatusChecked && (
                        <div className="text-sm text-indigo-100 bg-white/5 rounded-lg px-3 py-2">
                            正在检查管理员权限...
                        </div>
                    )}

                    {inviteCodeError && (
                        <div className="text-sm text-red-200 bg-red-500/10 border border-red-300/20 rounded-lg px-3 py-2">
                            {inviteCodeError}
                        </div>
                    )}

                    {isAdmin && (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_auto] gap-3 items-end">
                                <div>
                                    <label className="text-xs text-indigo-200">邀请码</label>
                                    <input
                                        type="text"
                                        value={inviteCodeDraft.code}
                                        onChange={event => onUpdateInviteCodeDraft('code', event.target.value)}
                                        placeholder="例如：spring-2026-admin"
                                        className="w-full mt-1 p-2 rounded bg-black/30 border-white/20 text-white text-base"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-indigo-200">可用次数</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={inviteCodeDraft.maxUses}
                                        onChange={event => onUpdateInviteCodeDraft('maxUses', event.target.value)}
                                        className="w-full mt-1 p-2 rounded bg-black/30 border-white/20 text-white text-base"
                                    />
                                </div>
                                <button
                                    onClick={onCreateInviteCode}
                                    disabled={isCreatingInviteCode}
                                    className="h-10 px-4 rounded bg-emerald-500 hover:bg-emerald-600 text-white font-medium disabled:opacity-50 flex items-center justify-center gap-1"
                                >
                                    {isCreatingInviteCode ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                    新增
                                </button>
                            </div>

                            <div className="space-y-2">
                                {inviteCodesLoading && (
                                    <div className="text-sm text-indigo-100 bg-white/5 rounded-lg px-3 py-2">
                                        正在加载邀请码...
                                    </div>
                                )}

                                {!inviteCodesLoading && inviteCodes.length === 0 && (
                                    <div className="text-sm text-indigo-100 bg-white/5 rounded-lg px-3 py-2">
                                        当前还没有邀请码，先创建一个吧。
                                    </div>
                                )}

                                {inviteCodes.map(inviteCode => (
                                    <div key={inviteCode.id} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-mono text-sm text-white break-all">{inviteCode.code}</span>
                                                <span className={`text-[11px] px-2 py-0.5 rounded-full ${inviteCode.isActive ? 'bg-emerald-500/20 text-emerald-200' : 'bg-slate-500/20 text-slate-300'}`}>
                                                    {inviteCode.isActive ? '启用中' : '已停用'}
                                                </span>
                                            </div>
                                            <div className="text-xs text-indigo-100/80 mt-1">
                                                已使用 {inviteCode.usedCount} / {inviteCode.maxUses}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => onToggleInviteCode(inviteCode)}
                                                disabled={inviteCodeMutatingId === inviteCode.id}
                                                className="text-xs px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-white disabled:opacity-50"
                                            >
                                                {inviteCodeMutatingId === inviteCode.id ? '处理中...' : inviteCode.isActive ? '停用' : '启用'}
                                            </button>
                                            <button
                                                onClick={() => onDeleteInviteCode(inviteCode.id)}
                                                disabled={inviteCodeMutatingId === inviteCode.id}
                                                className="text-xs px-3 py-1.5 rounded bg-red-500/20 hover:bg-red-500/30 text-red-100 disabled:opacity-50 flex items-center gap-1"
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
