import { useAuthStore } from '../store/auth';
import { useChatStore } from '../store/chat';
import { useFriendStore } from '../store/friend';
import { MessageIcon, UsersIcon, UserIcon, LogoutIcon, DashboardIcon } from './icons';

interface Props {
  activeTab: 'chat' | 'contacts' | 'admin';
  onTabChange: (tab: 'chat' | 'contacts' | 'admin') => void;
  onOpenProfile: (userId: string) => void;
}

export default function Sidebar({ activeTab, onTabChange, onOpenProfile }: Props) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const fetchConversations = useChatStore((s) => s.fetchConversations);
  const totalUnread = useChatStore((s) => Object.values(s.unreadCount).reduce((a, b) => a + b, 0));
  const pendingRequests = useFriendStore((s) => s.requests.length);

  return (
    <aside className="chat-sidebar" aria-label="主导航">
      <button
        onClick={() => { onTabChange('chat'); fetchConversations(); }}
        className={`nav-item-qq ${activeTab === 'chat' ? 'active' : ''}`}
        aria-label="消息"
        title="消息"
      >
        <MessageIcon size={20} />
        {totalUnread > 0 && activeTab !== 'chat' && (
          <span className="nav-badge">{totalUnread > 99 ? '99+' : totalUnread}</span>
        )}
      </button>

      <button
        onClick={() => onTabChange('contacts')}
        className={`nav-item-qq ${activeTab === 'contacts' ? 'active' : ''}`}
        aria-label="联系人"
        title="联系人"
      >
        <UsersIcon size={20} />
        {pendingRequests > 0 && activeTab !== 'contacts' && (
          <span className="nav-badge">{pendingRequests}</span>
        )}
      </button>

      {user?.role === 'admin' && (
        <button
          onClick={() => onTabChange('admin')}
          className={`nav-item-qq ${activeTab === 'admin' ? 'active' : ''}`}
          aria-label="管理后台"
          title="管理后台"
        >
          <DashboardIcon size={20} />
        </button>
      )}

      <div className="flex-1" />

      <button
        onClick={() => onOpenProfile(user?.id || '')}
        className="nav-item-qq"
        aria-label="个人资料"
        title="个人资料"
      >
        <UserIcon size={20} />
      </button>

      <button onClick={logout} className="nav-item-qq is-danger" aria-label="退出登录" title="退出登录">
        <LogoutIcon size={20} />
      </button>
    </aside>
  );
}
