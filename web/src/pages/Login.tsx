import { useState } from 'react';
import { useAuthStore } from '../store/auth';

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isRegister) {
        await register(username, password, nickname);
      } else {
        await login(username, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: 'var(--bg-primary)' }}>

      {/* 背景装饰 */}
      <div style={{
        position: 'absolute', top: '-20%', left: '-10%',
        width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(108,92,231,0.12) 0%, transparent 70%)',
        filter: 'blur(60px)',
      }} />
      <div style={{
        position: 'absolute', bottom: '-15%', right: '-5%',
        width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,210,160,0.08) 0%, transparent 70%)',
        filter: 'blur(60px)',
      }} />

      {/* 登录卡片 */}
      <div className="animate-fade-in relative z-10 w-[420px] p-10 rounded-2xl"
        style={{
          background: 'rgba(22, 22, 37, 0.85)',
          backdropFilter: 'blur(20px)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg), var(--shadow-glow)',
        }}>

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{
              background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))',
              boxShadow: '0 4px 20px rgba(108, 92, 231, 0.35)',
            }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Golang QQ
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {isRegister ? '创建新账号' : '欢迎回来'}
          </p>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="animate-fade-in mb-5 p-3 rounded-xl text-sm flex items-center gap-2"
            style={{ background: 'rgba(255,107,107,0.12)', color: 'var(--danger)', border: '1px solid rgba(255,107,107,0.2)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            {error}
          </div>
        )}

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5 ml-1" style={{ color: 'var(--text-secondary)' }}>
              用户名
            </label>
            <input
              type="text"
              placeholder="请输入用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 rounded-xl outline-none text-sm"
              style={{
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
              }}
              required
            />
          </div>

          {isRegister && (
            <div className="animate-fade-in">
              <label className="block text-xs font-medium mb-1.5 ml-1" style={{ color: 'var(--text-secondary)' }}>
                昵称
              </label>
              <input
                type="text"
                placeholder="请输入昵称"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full px-4 py-3 rounded-xl outline-none text-sm"
                style={{
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                }}
                required
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium mb-1.5 ml-1" style={{ color: 'var(--text-secondary)' }}>
              密码
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 pr-11 rounded-xl outline-none text-sm"
                style={{
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                style={{ color: 'var(--text-muted)' }}
                title={showPassword ? '隐藏密码' : '显示密码'}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-medium cursor-pointer text-white text-sm"
            style={{
              background: loading
                ? 'var(--accent-dark)'
                : 'linear-gradient(135deg, var(--accent), var(--accent-dark))',
              boxShadow: loading ? 'none' : '0 4px 15px rgba(108, 92, 231, 0.4)',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? '处理中...' : isRegister ? '注 册' : '登 录'}
          </button>
        </form>

        {/* 切换 */}
        <div className="mt-6 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
          {isRegister ? '已有账号？' : '没有账号？'}
          <button
            onClick={() => { setIsRegister(!isRegister); setError(''); }}
            className="ml-1 cursor-pointer font-medium"
            style={{ color: 'var(--accent-light)' }}
          >
            {isRegister ? '去登录' : '去注册'}
          </button>
        </div>
      </div>
    </div>
  );
}
