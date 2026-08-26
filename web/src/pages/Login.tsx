import { useState } from 'react';
import { useAuthStore } from '../store/auth';
import { UserIcon, LockIcon, EyeIcon, EyeOffIcon, AlertIcon, SpinnerIcon, MessageIcon } from '../components/icons';
import LoginBackground from '../components/LoginBackground';

function getPasswordStrength(pwd: string): { level: number; text: string; color: string } {
  if (!pwd) return { level: 0, text: '', color: '' };
  let score = 0;
  if (pwd.length >= 6) score++;
  if (pwd.length >= 10) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return { level: 1, text: '弱', color: '#ef4444' };
  if (score <= 3) return { level: 2, text: '中', color: '#f59e0b' };
  return { level: 3, text: '强', color: '#22c55e' };
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

  const switchTab = (tab: 'login' | 'register') => {
    setActiveTab(tab);
    setError('');
  };

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
    <div className="lg-page">
      {/* 科技感背景（参考 trae.cn）：粒子星网 + 光晕 + 网格 + 扫描线 */}
      <LoginBackground />

      {/* 右侧登录卡片 */}
      <div className="lg-card">
        {/* 品牌 */}
        <div className="lg-brand">
          <div className="lg-brand-logo">
            <MessageIcon size={22} />
          </div>
          <div className="lg-brand-text">
            <h2>Golang QQ</h2>
            <span>GO IM PROJECT</span>
          </div>
        </div>

        {/* 登录 / 注册切换 */}
        <div className="lg-tabs">
          <button
            type="button"
            className={activeTab === 'login' ? 'active' : ''}
            onClick={() => switchTab('login')}
          >
            登录
          </button>
          <button
            type="button"
            className={activeTab === 'register' ? 'active' : ''}
            onClick={() => switchTab('register')}
          >
            注册
          </button>
        </div>

        <h2 className="lg-heading">
          {activeTab === 'login' ? '欢迎回来' : '创建账号'}
        </h2>
        <p className="lg-sub">
          {activeTab === 'login' ? '登录您的 Golang QQ 账号，继续畅聊' : '填写信息即可快速注册'}
        </p>

        {/* 错误提示 */}
        {error && (
          <div className="lg-error">
            <AlertIcon size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* 用户名 */}
          <div className="lg-field">
            <label htmlFor="lg-username">用户名</label>
            <div className="lg-input">
              <input
                type="text"
                id="lg-username"
                placeholder="请输入用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                required
              />
              <span className="lg-input-icon">
                <UserIcon size={19} />
              </span>
            </div>
          </div>

          {/* 昵称（仅注册） */}
          {activeTab === 'register' && (
            <div className="lg-field animate-fade-in">
              <label htmlFor="lg-nickname">昵称</label>
              <div className="lg-input">
                <input
                  type="text"
                  id="lg-nickname"
                  placeholder="请输入昵称"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  required
                />
                <span className="lg-input-icon">
                  <UserIcon size={19} />
                </span>
              </div>
            </div>
          )}

          {/* 密码 */}
          <div className="lg-field">
            <label htmlFor="lg-password">密码</label>
            <div className="lg-input">
              <input
                type={showPassword ? 'text' : 'password'}
                id="lg-password"
                placeholder={activeTab === 'login' ? '输入您的密码' : '设置密码'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <span className="lg-input-icon">
                <LockIcon size={19} />
              </span>
              <button type="button" className="lg-pwd-toggle" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOffIcon size={19} /> : <EyeIcon size={19} />}
              </button>
            </div>

            {/* 密码强度（注册） */}
            {activeTab === 'register' && password && (
              <div className="lg-strength animate-fade-in">
                <div className="lg-bar">
                  {[1, 2, 3].map((lvl) => (
                    <i key={lvl} style={{ background: strength.level >= lvl ? strength.color : 'rgba(255,255,255,0.08)' }} />
                  ))}
                </div>
                <span style={{ color: strength.color }}>{strength.text}</span>
              </div>
            )}
          </div>

          {/* 确认密码（仅注册） */}
          {activeTab === 'register' && (
            <div className="lg-field animate-fade-in">
              <label htmlFor="lg-confirm-pwd">确认密码</label>
              <div className="lg-input">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="lg-confirm-pwd"
                  placeholder="再次输入密码"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                <span className="lg-input-icon">
                  <LockIcon size={19} />
                </span>
              </div>
              {confirmPassword && confirmPassword !== password && (
                <p style={{ fontSize: '12px', color: '#fca5a5', marginTop: '6px' }}>两次密码不一致</p>
              )}
            </div>
          )}

          {/* 记住我 + 忘记密码（仅登录） */}
          {activeTab === 'login' && (
            <div className="lg-row">
              <label className="lg-remember">
                <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                <span>记住我</span>
              </label>
              <button type="button" className="lg-forgot" onClick={(e) => e.preventDefault()}>
                忘记密码？
              </button>
            </div>
          )}

          {/* 提交 */}
          <button type="submit" disabled={loading} className="lg-submit">
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <SpinnerIcon size={16} className="animate-spin" />
                处理中...
              </span>
            ) : activeTab === 'login' ? '登 录' : '注 册'}
          </button>
        </form>

        {/* 分隔线 */}
        <div className="lg-divider">
          <span>或</span>
        </div>

        {/* 社交登录 */}
        <div className="lg-social">
          <button className="lg-social-btn" title="GitHub">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
          </button>
          <button className="lg-social-btn" title="微信">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 00.167-.054l1.903-1.114a.864.864 0 01.717-.098 10.16 10.16 0 002.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178A1.17 1.17 0 014.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178 1.17 1.17 0 01-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 01.598.082l1.584.926a.272.272 0 00.14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 01-.023-.156.49.49 0 01.201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.01-.269-.03-.407-.03zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 01-.969.983.976.976 0 01-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 01-.969.983.976.976 0 01-.969-.983c0-.542.434-.982.969-.982z" />
            </svg>
          </button>
          <button className="lg-social-btn" title="QQ">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.003 2c-2.265 0-6.29 1.364-6.29 7.325v1.195S3.55 14.96 3.55 17.474c0 .665.17 1.025.281 1.025.114 0 .902-.484 1.748-2.072 0 0-.18 2.197 1.904 3.967 0 0-1.77.495-1.77 1.182 0 .686 4.078.43 6.29.43 2.21 0 6.287.257 6.287-.43 0-.687-1.768-1.182-1.768-1.182 2.085-1.77 1.905-3.967 1.905-3.967.845 1.588 1.634 2.072 1.746 2.072.111 0 .283-.36.283-1.025 0-2.514-2.166-6.954-2.166-6.954V9.325C18.29 3.364 14.268 2 12.003 2z" />
            </svg>
          </button>
        </div>

        {/* 切换登录/注册 */}
        <div className="lg-switch">
          {activeTab === 'login' ? '还没有账号？' : '已有账号？'}
          <button type="button" onClick={() => switchTab(activeTab === 'login' ? 'register' : 'login')}>
            {activeTab === 'login' ? '立即注册' : '立即登录'}
          </button>
        </div>
      </div>
    </div>
  );
}
