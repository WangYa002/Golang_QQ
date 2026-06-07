import { useState } from 'react';
import { useAuthStore } from '../store/auth';

function getPasswordStrength(pwd: string): { level: number; text: string; color: string } {
  if (!pwd) return { level: 0, text: '', color: '' };
  let score = 0;
  if (pwd.length >= 6) score++;
  if (pwd.length >= 10) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return { level: 1, text: '弱', color: 'var(--danger)' };
  if (score <= 3) return { level: 2, text: '中', color: 'var(--warning)' };
  return { level: 3, text: '强', color: 'var(--success)' };
}

export default function Login() {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);

  const strength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (activeTab === 'register' && password !== confirmPassword) {
      setError('两次密码不一致');
      return;
    }
    setLoading(true);
    try {
      if (activeTab === 'register') {
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
    <div className="min-h-screen flex" style={{ background: 'var(--bg-primary)' }}>

      {/* 左侧展示区 */}
      <div className="hidden lg:flex flex-1 flex-col items-center justify-center relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a3e 50%, #0f0f1a 100%)' }}>

        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="absolute rounded-full"
            style={{
              width: 8 + i * 4,
              height: 8 + i * 4,
              background: `rgba(108, 92, 231, ${0.15 + i * 0.05})`,
              left: `${15 + i * 14}%`,
              top: `${20 + (i % 3) * 25}%`,
              animation: `floatUp ${8 + i * 2}s linear ${i * 1.5}s infinite`,
            }} />
        ))}

        <div className="relative z-10 text-center px-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-8"
            style={{
              background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))',
              boxShadow: '0 8px 32px rgba(108, 92, 231, 0.4)',
            }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            Golang QQ
          </h1>
          <p className="text-lg mb-8" style={{ color: 'var(--text-secondary)' }}>
            基于 Go + React 的即时通讯应用
          </p>
          <div className="space-y-4 text-left max-w-xs mx-auto">
            {[
              { icon: '💬', title: '实时通讯', desc: 'WebSocket 驱动的即时消息' },
              { icon: '👥', title: '群组聊天', desc: '创建群组与多人协作' },
              { icon: '🔒', title: '安全可靠', desc: 'JWT 认证与数据加密' },
            ].map((feat, i) => (
              <div key={i} className="flex items-center gap-4 p-3 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                <span className="text-2xl">{feat.icon}</span>
                <div>
                  <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{feat.title}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{feat.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 右侧表单区 */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="animate-fade-in w-full max-w-[400px]">

          {/* Logo (mobile) */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Golang QQ</h1>
          </div>

          {/* Tab 切换 */}
          <div className="flex mb-8 p-1 rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
            {(['login', 'register'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setError(''); }}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer"
                style={{
                  background: activeTab === tab ? 'var(--accent)' : 'transparent',
                  color: activeTab === tab ? '#fff' : 'var(--text-secondary)',
                  boxShadow: activeTab === tab ? '0 2px 10px rgba(108, 92, 231, 0.3)' : 'none',
                }}
              >
                {tab === 'login' ? '登录' : '注册'}
              </button>
            ))}
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

            {activeTab === 'register' && (
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
              {activeTab === 'register' && password && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 flex gap-1">
                    {[1, 2, 3].map((lvl) => (
                      <div key={lvl} className="flex-1 h-1 rounded-full"
                        style={{ background: strength.level >= lvl ? strength.color : 'var(--bg-tertiary)' }} />
                    ))}
                  </div>
                  <span className="text-xs" style={{ color: strength.color }}>{strength.text}</span>
                </div>
              )}
            </div>

            {activeTab === 'register' && (
              <div className="animate-fade-in">
                <label className="block text-xs font-medium mb-1.5 ml-1" style={{ color: 'var(--text-secondary)' }}>
                  确认密码
                </label>
                <input
                  type="password"
                  placeholder="再次输入密码"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl outline-none text-sm"
                  style={{
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                  }}
                  required
                />
                {confirmPassword && confirmPassword !== password && (
                  <p className="text-xs mt-1 ml-1" style={{ color: 'var(--danger)' }}>密码不一致</p>
                )}
              </div>
            )}

            {activeTab === 'login' && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded cursor-pointer"
                  style={{ accentColor: 'var(--accent)' }}
                />
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>记住登录</span>
              </div>
            )}

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
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" strokeDasharray="31.4" strokeDashoffset="10" />
                  </svg>
                  处理中...
                </span>
              ) : activeTab === 'login' ? '登 录' : '注 册'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
