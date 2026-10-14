import { useState } from 'react';
import { ArrowRight, BookOpen, Check, Lock, RefreshCw, User, X } from 'lucide-react';

const API_BASE = '/api';

export default function AuthScreen({ onLogin }) {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

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
                setNotice('注册成功，用新账号登录即可开始学习。');
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
        <div className="auth-page">
            <div className="auth-story"><div className="brand"><BookOpen size={32} strokeWidth={1.6} /><span>记忆飞船</span></div><div className="auth-story-content"><h1>遇见一个词。<br />留住一个世界。</h1><p>从阅读中的偶然相遇，到下一次自然而然地想起。<br />建立自己的词库，让记忆慢慢发生。</p><div className="auth-sample"><span>serendipity</span><small>意外发现美好事物的幸运</small><div className="word-divider" /><p>A little serendipity brought us together.</p></div></div><small className="auth-story-footer">记录 · 回想 · 掌握</small></div>
            <div className="auth-form-area"><div className="auth-mobile-brand brand"><BookOpen size={28} /><span>记忆飞船</span></div><div className="auth-form">
                <h2>{isLogin ? '欢迎回来。' : '开始你的积累。'}</h2><p className="auth-subtitle">{isLogin ? '你的词库和学习进度，都在这里。' : '创建账号，让每一个新词都有归处。'}</p>
                {error && <p className="form-error" role="alert"><X size={16} />{error}</p>}
                {notice && <p className="form-notice" role="status"><Check size={16} />{notice}</p>}
                <form onSubmit={handleSubmit}>
                    <label htmlFor="auth-username">用户名</label><div className="auth-field"><User size={18} /><input id="auth-username" type="text" required autoComplete="username" autoCapitalize="none" value={username} onChange={event => setUsername(event.target.value)} placeholder="请输入用户名" /></div>
                    <label htmlFor="auth-password">密码</label><div className="auth-field"><Lock size={18} /><input id="auth-password" type="password" required autoComplete={isLogin ? 'current-password' : 'new-password'} value={password} onChange={event => setPassword(event.target.value)} placeholder="请输入密码" /></div>
                    {!isLogin && <><label htmlFor="auth-invite">邀请码</label><div className="auth-field"><Check size={18} /><input id="auth-invite" type="text" autoComplete="off" value={inviteCode} onChange={event => setInviteCode(event.target.value)} placeholder="请输入邀请码" /></div><p className="invite-hint">由管理员提供，管理员首次初始化可留空。</p></>}
                    <button className="primary-button auth-submit" type="submit" disabled={loading}>{loading ? <RefreshCw size={18} className="animate-spin" /> : null}{loading ? '请稍候…' : isLogin ? '登录，继续学习' : '创建账号'}{!loading && <ArrowRight size={18} />}</button>
                </form>
                <p className="auth-switch">{isLogin ? '还没有账号？' : '已有账号？'}<button onClick={() => { setIsLogin(!isLogin); setError(''); setNotice(''); }}>{isLogin ? '创建账号' : '返回登录'}</button></p>
                <p className="auth-footnote">英语 / 日语词典 · 间隔复习 · 云端同步</p>
            </div></div>
        </div>
    );
}
