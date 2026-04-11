import { useState } from 'react';
import { Check, Layers, Lock, RefreshCw, User, X } from 'lucide-react';

const API_BASE = '/api';

export default function AuthScreen({ onLogin }) {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async event => {
        event.preventDefault();
        setLoading(true);
        setError('');

        const endpoint = isLogin ? '/login' : '/register';
        const payload = { username, password };
        if (!isLogin) payload.inviteCode = inviteCode;

        try {
            const response = await fetch(`${API_BASE}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || '操作失败');

            if (isLogin) {
                onLogin(data.token, data.username);
            } else {
                alert('注册成功！请登录');
                setIsLogin(true);
                setInviteCode('');
            }
        } catch (error) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="bg-indigo-600 p-8 text-center">
                    <Layers className="w-12 h-12 text-yellow-300 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-white">
                        记忆飞船 <span className="text-xs opacity-70 bg-white/20 px-2 py-1 rounded">Cloud</span>
                    </h1>
                    <p className="text-indigo-200 mt-2 text-sm">你的云端单词基地</p>
                </div>
                <div className="p-8">
                    <h2 className="text-xl font-bold text-slate-800 mb-6 text-center">
                        {isLogin ? '欢迎回来' : '创建新账号'}
                    </h2>
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
                            <X className="w-4 h-4" /> {error}
                        </div>
                    )}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-500 mb-1">用户名</label>
                            <div className="relative">
                                <User className="w-5 h-5 text-slate-400 absolute left-3 top-3" />
                                <input
                                    type="text"
                                    required
                                    value={username}
                                    onChange={event => setUsername(event.target.value)}
                                    className="w-full pl-10 p-3 bg-slate-50 border rounded-xl focus:ring-2 ring-indigo-500 outline-none"
                                    placeholder="请输入用户名"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-500 mb-1">密码</label>
                            <div className="relative">
                                <Lock className="w-5 h-5 text-slate-400 absolute left-3 top-3" />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={event => setPassword(event.target.value)}
                                    className="w-full pl-10 p-3 bg-slate-50 border rounded-xl focus:ring-2 ring-indigo-500 outline-none"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>
                        {!isLogin && (
                            <div className="animate-in slide-in-from-top-2">
                                <label className="block text-sm font-medium text-slate-500 mb-1">
                                    邀请码 <span className="text-xs text-indigo-500">(防机器人)</span>
                                </label>
                                <div className="relative">
                                    <Check className="w-5 h-5 text-slate-400 absolute left-3 top-3" />
                                    <input
                                        type="text"
                                        value={inviteCode}
                                        onChange={event => setInviteCode(event.target.value)}
                                        className="w-full pl-10 p-3 bg-slate-50 border border-indigo-100 rounded-xl focus:ring-2 ring-indigo-500 outline-none"
                                        placeholder="请输入邀请码（管理员首次初始化可留空）"
                                    />
                                </div>
                            </div>
                        )}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 transition disabled:opacity-50 flex justify-center items-center gap-2"
                        >
                            {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
                            {isLogin ? '登录' : '注册'}
                        </button>
                    </form>
                    <div className="mt-6 text-center text-sm">
                        <span className="text-slate-400">{isLogin ? '还没有账号？' : '已有账号？'}</span>
                        <button
                            onClick={() => {
                                setIsLogin(!isLogin);
                                setError('');
                            }}
                            className="text-indigo-600 font-bold ml-1 hover:underline"
                        >
                            {isLogin ? '去注册' : '去登录'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
