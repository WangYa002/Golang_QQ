import { useState } from 'react';
import { useAccountsStore } from '../store/accounts';
import { useAuthStore } from '../store/auth';
import { useChatStore } from '../store/chat';
import { CloseIcon, UserPlusIcon, LogoutIcon, CheckIcon } from './icons';
import { inputStyle, hoverHandlers } from '../styles/common';
import Portal from './Portal';

/**
 * 账号切换器 —— Sidebar 顶部的多账号入口。
 *
 * 交互：
 *  - 默认显示当前账号头像（点击 → 展开/收起账号面板）
 *  - 面板列出所有账号，点击切换；当前账号带勾选标记
 *  - "添加账号" → 弹出精简登录窗，登录成功后自动切换到新账号
 *  - 每个账号可单独登出（不影响其他账号）
 */
export default function AccountSwitcher() {
  const accounts = useAccountsStore((s) => s.accounts);
  const activeId = useAccountsStore((s) => s.activeId);
  const switchAccount = useAccountsStore((s) => s.switchAccount);
  const removeAccount = useAccountsStore((s) => s.removeAccount);
  const login = useAuthStore((s) => s.login);

  const [showPanel, setShowPanel] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const active = accounts.find((a) => a.userId === activeId) ?? null;
  const initial = active?.user.nickname?.[0] || active?.user.username?.[0] || '?';

  const handleSwitch = (userId: string) => {
    if (userId === activeId) {
      setShowPanel(false);
      return;
    }
    switchAccount(userId);
    // 切换后加载新账号会话（chat store 视图已自动刷新，需拉取数据）
    setTimeout(() => {
      useChatStore.getState().fetchConversations();
    }, 0);
    setShowPanel(false);
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      // login 内部已 addAccount + 切换；加载新账号数据
      setTimeout(() => {
        useChatStore.getState().fetchConversations();
      }, 0);
      setShowLogin(false);
      setShowPanel(false);
      setUsername('');
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeAccount(userId);
    // 切到新账号后加载其数据
    setTimeout(() => {
      if (useAccountsStore.getState().activeId) {
        useChatStore.getState().fetchConversations();
      }
    }, 0);
  };

  return (
    <div className="relative">
      {/* 当前账号头像入口 */}
      <button
        onClick={() => setShowPanel((v) => !v)}
        className="relative group cursor-pointer"
        title={active ? `${active.user.nickname || active.user.username}` : '未登录'}
      >
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold transition-transform group-hover:scale-105 sidebar-avatar"
          style={{ color: '#fff' }}
        >
          {initial}
        </div>
        {/* 在线状态点 */}
        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
          style={{ background: 'var(--online)', borderColor: 'var(--bg-secondary)' }} />
        {/* 账号数量徽章 */}
        {accounts.length > 1 && (
          <div className="absolute -top-1 -right-1 min-w-[16px] h-[16px] rounded-full flex items-center justify-center text-[9px] font-bold px-0.5"
            style={{ background: 'var(--accent-light)', color: '#fff' }}>
            {accounts.length}
          </div>
        )}
      </button>

      {/* 账号列表面板 */}
      {showPanel && (
        <Portal>
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowPanel(false)} />
          <div className="fixed top-20 left-[76px] z-50 w-[260px] rounded-xl animate-fade-in"
            style={{
              background: 'var(--bg-secondary)',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--border)',
            }}>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                账号
              </span>
              <button
                onClick={() => setShowPanel(false)}
                className="w-6 h-6 rounded-md flex items-center justify-center cursor-pointer"
                style={{ color: 'var(--text-muted)' }}
                {...hoverHandlers()}
              >
                <CloseIcon size={14} />
              </button>
            </div>
            <div className="p-3">
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {accounts.map((acc) => {
                const isActive = acc.userId === activeId;
                const name = acc.user.nickname || acc.user.username || '未知';
                return (
                  <div
                    key={acc.userId}
                    onClick={() => handleSwitch(acc.userId)}
                    className="group flex items-center gap-2.5 p-2 rounded-lg cursor-pointer"
                    style={{ background: isActive ? 'var(--bg-active)' : 'transparent' }}
                    {...hoverHandlers({ leaveBg: isActive ? 'var(--bg-active)' : 'transparent' })}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: `linear-gradient(135deg, var(--accent), #6366f1)`, color: '#fff' }}>
                      {name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                        {name}
                      </div>
                      {acc.user.username && (
                        <div className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                          @{acc.user.username}
                        </div>
                      )}
                    </div>
                    {isActive ? (
                      <CheckIcon size={16} className="text-[var(--accent-light)]" />
                    ) : (
                      <button
                        onClick={(e) => handleLogout(acc.userId, e)}
                        className="w-7 h-7 rounded-md flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100"
                        style={{ color: 'var(--danger)' }}
                        title="退出此账号"
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <LogoutIcon size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="my-2" style={{ borderTop: '1px solid var(--border)' }} />

            <button
              onClick={() => { setShowLogin(true); setShowPanel(false); }}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm cursor-pointer"
              style={{ color: 'var(--accent-light)' }}
              {...hoverHandlers()}
            >
              <UserPlusIcon size={16} />
              添加账号
            </button>
            </div>
          </div>
        </>
        </Portal>
      )}

      {/* 添加账号（精简登录）弹窗 */}
      {showLogin && (
        <Portal>
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowLogin(false); }}>
          <div className="animate-fade-in w-[360px] rounded-xl overflow-hidden"
            style={{ background: 'var(--bg-secondary)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>添加账号</h3>
              <button
                onClick={() => setShowLogin(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
                style={{ color: 'var(--text-secondary)' }}
                {...hoverHandlers()}
              >
                <CloseIcon size={16} />
              </button>
            </div>

            <div className="p-6">
            {error && (
              <div className="mb-4 p-3 rounded-xl text-sm" style={{
                background: 'rgba(239,68,68,0.12)', color: 'var(--danger)',
                border: '1px solid rgba(239,68,68,0.2)',
              }}>
                {error}
              </div>
            )}

            <form onSubmit={handleAddAccount} className="space-y-4">
              <input
                type="text"
                placeholder="用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-xl outline-none text-sm"
                style={inputStyle}
                autoFocus
                required
              />
              <input
                type="password"
                placeholder="密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl outline-none text-sm"
                style={inputStyle}
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl font-medium cursor-pointer text-white text-sm"
                style={{
                  background: loading ? 'var(--accent-dark)' : 'var(--accent)',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? '登录中...' : '登录并切换'}
              </button>
            </form>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  );
}
