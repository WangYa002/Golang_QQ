import { useState } from 'react';
import { useAccountsStore } from '../store/accounts';
import { useAuthStore } from '../store/auth';
import { useChatStore } from '../store/chat';
import { avatarSrc } from '../api/client';
import { CloseIcon, UserPlusIcon, LogoutIcon } from './icons';
import { Avatar } from './ui/Avatar';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { IconButton } from './ui/IconButton';
import { Modal } from './ui/Modal';

interface Props {
  onOpenProfile?: (userId: string) => void;
}

/**
 * 账号切换器 —— Sidebar 顶部的多账号入口。
 */
export default function AccountSwitcher({ onOpenProfile }: Props) {
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
  const otherAccounts = accounts.filter((a) => a.userId !== activeId);

  const handleSwitch = (userId: string) => {
    if (userId === activeId) {
      setShowPanel(false);
      return;
    }
    switchAccount(userId);
    setTimeout(() => { useChatStore.getState().fetchConversations(); }, 0);
    setShowPanel(false);
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      setTimeout(() => { useChatStore.getState().fetchConversations(); }, 0);
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
    setTimeout(() => {
      if (useAccountsStore.getState().activeId) {
        useChatStore.getState().fetchConversations();
      }
    }, 0);
  };

  const currentName = active?.user.nickname || active?.user.username || '';

  return (
    <div className="relative">
      <button
        onClick={() => setShowPanel((v) => !v)}
        className="relative cursor-pointer"
        title={currentName || '未登录'}
      >
        <Avatar name={currentName} src={avatarSrc(active?.user.avatar)} size="sm" online showOnlineDot />
      </button>

      {showPanel && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowPanel(false)} />
            <div
              className="fixed left-[12px] top-[60px] z-50 w-[260px] rounded-xl animate-fade-in"
              style={{ background: 'var(--bg-secondary)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}
            >
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                账号
              </span>
              <IconButton label="关闭" size="sm" onClick={() => setShowPanel(false)}>
                <CloseIcon size={14} />
              </IconButton>
            </div>
            {active && (
              <div className="px-4 pt-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center gap-3">
                  <Avatar name={currentName} src={avatarSrc(active.user.avatar)} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{currentName}</div>
                    <div className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>@{active.user.username}</div>
                    {active.user.bio && (
                      <div className="mt-0.5 truncate text-xs" style={{ color: 'var(--text-secondary)' }}>{active.user.bio}</div>
                    )}
                  </div>
                </div>
                {onOpenProfile && (
                  <Button variant="ghost" size="sm" block className="mt-3" onClick={() => onOpenProfile(active.userId)}>
                    查看资料
                  </Button>
                )}
              </div>
            )}
            <div className="p-3">
              {otherAccounts.length > 0 && (
                <>
                  <div className="mb-1 px-1 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    切换账号
                  </div>
                  <div className="max-h-48 space-y-1 overflow-y-auto">
                    {otherAccounts.map((acc) => {
                      const name = acc.user.nickname || acc.user.username || '未知';
                      return (
                        <div
                          key={acc.userId}
                          onClick={() => handleSwitch(acc.userId)}
                          className="group flex cursor-pointer items-center gap-2.5 rounded-lg p-2 hoverable"
                        >
                          <Avatar name={name} src={avatarSrc(acc.user.avatar)} size="sm" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                              {name}
                            </div>
                            {acc.user.username && (
                              <div className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                                @{acc.user.username}
                              </div>
                            )}
                          </div>
                          <IconButton label="退出此账号" size="sm" danger onClick={(e) => handleLogout(acc.userId, e)}>
                            <LogoutIcon size={14} />
                          </IconButton>
                        </div>
                      );
                    })}
                  </div>
                  <div className="my-2" style={{ borderTop: '1px solid var(--border)' }} />
                </>
              )}

              <button
                onClick={() => { setShowLogin(true); setShowPanel(false); }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm hoverable"
                style={{ color: 'var(--accent)' }}
              >
                <UserPlusIcon size={16} />
                添加账号
              </button>
            </div>
          </div>
        </>
      )}

      <Modal open={showLogin} title="添加账号" onClose={() => setShowLogin(false)} width={360}>
        {error && (
          <div className="mb-4 rounded-xl p-3 text-sm" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
            {error}
          </div>
        )}
        <form onSubmit={handleAddAccount} className="space-y-4">
          <Input placeholder="用户名" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required />
          <Input type="password" placeholder="密码" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <Button block variant="primary" size="lg" type="submit" loading={loading}>
            {loading ? '登录中...' : '登录并切换'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
