import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/auth';
import { UserIcon, LockIcon, MailIcon, EyeIcon, EyeOffIcon, AlertIcon, SpinnerIcon } from '../components/icons';

function getPasswordStrength(pwd: string): { level: number; text: string; color: string } {
  if (!pwd) return { level: 0, text: '', color: '' };
  let score = 0;
  if (pwd.length >= 6) score++;
  if (pwd.length >= 10) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return { level: 1, text: '弱', color: '#e5484d' };
  if (score <= 3) return { level: 2, text: '中', color: '#e79008' };
  return { level: 3, text: '强', color: '#2ba245' };
}

/**
 * 登录页 —— QQ 式双栏小窗：左品牌插画区 + 右表单区。
 * 登录默认账号密码，邮箱验证码为第二 tab；注册同窗切换。
 */
export default function Login() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loginMode, setLoginMode] = useState<'password' | 'email'>('password');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [rememberMe, setRememberMe] = useState(true);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const sendVerifyCode = useAuthStore((s) => s.sendVerifyCode);
  const loginWithEmail = useAuthStore((s) => s.loginWithEmail);

  const strength = getPasswordStrength(password);

  useEffect(() => {
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  const switchMode = (next: 'login' | 'register') => {
    setMode(next);
    setError('');
  };

  const switchLoginMode = (next: 'password' | 'email') => {
    setLoginMode(next);
    setError('');
  };

  const handleSendCode = async () => {
    if (!email.trim()) { setError('请输入邮箱'); return; }
    if (sending || countdown > 0) return;
    setError('');
    setSending(true);
    try {
      await sendVerifyCode(email.trim());
      setCountdown(60);
      countdownRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) { if (countdownRef.current) clearInterval(countdownRef.current); return 0; }
          return c - 1;
        });
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送失败');
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (mode === 'register' && password !== confirmPassword) {
      setError('两次密码不一致');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'register') {
        await register(username, password, nickname);
      } else if (loginMode === 'email') {
        if (!email.trim() || !code.trim()) { setError('请输入邮箱和验证码'); return; }
        await loginWithEmail(email.trim(), code.trim());
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
    <div className="ql-page">
      <div className="ql-window">
        {/* 左栏：品牌插画区（QQ 蓝） */}
        <div className="ql-aside">
          <div className="ql-aside-deco ql-aside-deco-a" />
          <div className="ql-aside-deco ql-aside-deco-b" />
          <div className="ql-aside-content">
            <div className="ql-logo"><img src="/icons/icon-180.png" alt="Golang QQ" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover' }} draggable={false} /></div>
            <h1 className="ql-title">Golang QQ</h1>
            <p className="ql-tagline">每一天，乐在沟通</p>
          </div>
          <p className="ql-aside-foot">GO · Gin · MongoDB · React</p>
        </div>

        {/* 右栏：表单区 */}
        <div className="ql-main">
          <div className="ql-head">
            <div className="ql-avatar" aria-hidden="true"><img src="/icons/icon-180.png" alt="Golang QQ" style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover' }} draggable={false} /></div>
          </div>

          {error && (
            <div className="ql-error"><AlertIcon size={15} />{error}</div>
          )}

          {mode === 'login' && (
            <div className="ql-tabs" role="tablist">
              <button type="button" role="tab" aria-selected={loginMode === 'password'}
                className={loginMode === 'password' ? 'active' : ''}
                onClick={() => switchLoginMode('password')}>账号密码登录</button>
              <button type="button" role="tab" aria-selected={loginMode === 'email'}
                className={loginMode === 'email' ? 'active' : ''}
                onClick={() => switchLoginMode('email')}>邮箱验证码登录</button>
            </div>
          )}
          {mode === 'register' && <h2 className="ql-form-title">注册新账号</h2>}

          <form onSubmit={handleSubmit}>
            {/* 邮箱验证码登录 */}
            {mode === 'login' && loginMode === 'email' && (
              <>
                <div className="ql-field">
                  <div className="ql-input">
                    <span className="ql-input-icon"><MailIcon size={17} /></span>
                    <input type="email" placeholder="QQ 邮箱" value={email}
                      onChange={(e) => setEmail(e.target.value)} autoFocus required />
                  </div>
                </div>
                <div className="ql-field">
                  <div className="ql-input">
                    <span className="ql-input-icon"><LockIcon size={17} /></span>
                    <input type="text" placeholder="6 位验证码" value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      maxLength={6} required />
                    <button type="button" className="ql-code-btn" onClick={handleSendCode}
                      disabled={sending || countdown > 0}>
                      {sending ? '发送中...' : countdown > 0 ? `${countdown}s` : '发送验证码'}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* 账号密码登录 / 注册 */}
            {(mode === 'register' || (mode === 'login' && loginMode === 'password')) && (
              <>
                <div className="ql-field">
                  <div className="ql-input">
                    <span className="ql-input-icon"><UserIcon size={17} /></span>
                    <input type="text" placeholder="用户名" value={username}
                      onChange={(e) => setUsername(e.target.value)} autoFocus required />
                  </div>
                </div>

                {mode === 'register' && (
                  <div className="ql-field">
                    <div className="ql-input">
                      <span className="ql-input-icon"><UserIcon size={17} /></span>
                      <input type="text" placeholder="昵称" value={nickname}
                        onChange={(e) => setNickname(e.target.value)} required />
                    </div>
                  </div>
                )}

                <div className="ql-field">
                  <div className="ql-input">
                    <span className="ql-input-icon"><LockIcon size={17} /></span>
                    <input type={showPassword ? 'text' : 'password'}
                      placeholder={mode === 'login' ? '密码' : '设置密码'} value={password}
                      onChange={(e) => setPassword(e.target.value)} required />
                    <button type="button" className="ql-pwd-toggle" onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? '隐藏密码' : '显示密码'}>
                      {showPassword ? <EyeOffIcon size={17} /> : <EyeIcon size={17} />}
                    </button>
                  </div>
                  {mode === 'register' && password && (
                    <div className="ql-strength">
                      <div className="ql-strength-bar">
                        {[1, 2, 3].map((lvl) => (
                          <i key={lvl} style={{ background: strength.level >= lvl ? strength.color : '#e3e7ec' }} />
                        ))}
                      </div>
                      <span style={{ color: strength.color }}>{strength.text}</span>
                    </div>
                  )}
                </div>

                {mode === 'register' && (
                  <div className="ql-field">
                    <div className="ql-input">
                      <span className="ql-input-icon"><LockIcon size={17} /></span>
                      <input type={showPassword ? 'text' : 'password'} placeholder="确认密码" value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)} required />
                    </div>
                    {confirmPassword && confirmPassword !== password && (
                      <p className="ql-mismatch">两次密码不一致</p>
                    )}
                  </div>
                )}
              </>
            )}

            {mode === 'login' && loginMode === 'password' && (
              <label className="ql-remember">
                <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                <span>自动登录</span>
              </label>
            )}

            <button type="submit" disabled={loading} className="ql-submit">
              {loading ? (
                <span className="ql-submit-loading">
                  <SpinnerIcon size={16} className="animate-spin" />
                  处理中...
                </span>
              ) : mode === 'register' ? '注 册' : '登 录'}
            </button>
          </form>

          <div className="ql-switch">
            {mode === 'login' ? (
              <button type="button" onClick={() => switchMode('register')}>注册新账号</button>
            ) : (
              <button type="button" onClick={() => switchMode('login')}>已有账号，去登录</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
