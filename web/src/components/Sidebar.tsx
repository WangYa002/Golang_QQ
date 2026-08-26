import { useState } from 'react';
import { useAuthStore } from '../store/auth';
import { useChatStore } from '../store/chat';
import { useFriendStore } from '../store/friend';
import * as userApi from '../api/users';
import { createConversation } from '../api/conversations';
import type { User } from '../types';
import { MessageIcon, UsersIcon, UserPlusIcon, UserIcon, LogoutIcon, CloseIcon, CheckIcon } from './icons';
import { inputStyle, hoverHandlers } from '../styles/common';
import AccountSwitcher from './AccountSwitcher';
import Portal from './Portal';

interface Props {
  activeTab: 'chat' | 'contacts';
  onTabChange: (tab: 'chat' | 'contacts') => void;
  onOpenProfile: (userId: string) => void;
}

export default function Sidebar({ activeTab, onTabChange, onOpenProfile }: Props) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const fetchConversations = useChatStore((s) => s.fetchConversations);
  const createGroup = useChatStore((s) => s.createGroup);
  const selectConversation = useChatStore((s) => s.selectConversation);
  const totalUnread = useChatStore((s) => Object.values(s.unreadCount).reduce((a, b) => a + b, 0));
  const pendingRequests = useFriendStore((s) => s.requests.length);

  const [showSearch, setShowSearch] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [groupSearchResults, setGroupSearchResults] = useState<User[]>([]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    const users = await userApi.searchUsers(searchQuery);
    setSearchResults(users);
  };

  const handleStartChat = async (userId: string) => {
    const convo = await createConversation(userId);
    await fetchConversations();
    selectConversation(convo.id);
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleGroupSearch = async () => {
    if (!groupSearchQuery.trim()) return;
    const users = await userApi.searchUsers(groupSearchQuery);
    setGroupSearchResults(users);
  };

  const toggleMember = (userId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedMembers.length === 0) return;
    await createGroup(groupName.trim(), selectedMembers);
    setShowCreateGroup(false);
    setGroupName('');
    setSelectedMembers([]);
    setGroupSearchQuery('');
    setGroupSearchResults([]);
  };

  return (
    <div className="flex flex-col items-center py-4 gap-2"
      style={{
        width: 64,
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
      }}>

      {/* 多账号切换器 */}
      <AccountSwitcher />

      <div className="w-8 h-px my-1" style={{ background: 'var(--border)' }} />

      {/* 消息 Tab */}
      <button
        onClick={() => { onTabChange('chat'); fetchConversations(); }}
        className={`nav-item-qq ${activeTab === 'chat' ? 'active' : ''}`}
        title="消息"
      >
        <MessageIcon size={20} />
        {totalUnread > 0 && activeTab !== 'chat' && (
          <span className="nav-badge">
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </button>

      {/* 联系人 Tab */}
      <button
        onClick={() => onTabChange('contacts')}
        className={`nav-item-qq ${activeTab === 'contacts' ? 'active' : ''}`}
        title="联系人"
      >
        <UsersIcon size={20} />
        {pendingRequests > 0 && activeTab !== 'contacts' && (
          <span className="nav-badge">
            {pendingRequests}
          </span>
        )}
      </button>

      {/* 添加好友 */}
      <button
        onClick={() => setShowSearch(true)}
        className="nav-item-qq"
        title="添加好友"
      >
        <UserPlusIcon size={20} />
      </button>

      {/* 创建群聊 */}
      <button
        onClick={() => setShowCreateGroup(true)}
        className="nav-item-qq"
        title="创建群聊"
      >
        <UsersIcon size={20} />
      </button>

      <div className="flex-1" />

      {/* 个人资料 */}
      <button
        onClick={() => onOpenProfile(user?.id || '')}
        className="nav-item-qq"
        title="个人资料"
      >
        <UserIcon size={20} />
      </button>

      {/* 退出 */}
      <button
        onClick={logout}
        className="nav-item-qq"
        style={{ color: 'var(--text-muted)' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = 'var(--danger)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
        title="退出登录"
      >
        <LogoutIcon size={20} />
      </button>

      {/* 搜索用户弹窗 */}
      {showSearch && (
        <Portal>
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowSearch(false); setSearchQuery(''); setSearchResults([]); } }}>
          <div className="animate-fade-in w-[400px] rounded-xl"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}>
            <div className="flex items-center justify-between p-5 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>搜索用户</h3>
              <button
                onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]); }}
                className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
                style={{ color: 'var(--text-secondary)' }}
                {...hoverHandlers()}
              >
                <CloseIcon size={16} />
              </button>
            </div>
            <div className="p-5">
              <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="输入用户名或昵称"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1 px-3.5 py-2.5 rounded-md outline-none text-sm"
                style={inputStyle}
                autoFocus
              />
              <button
                onClick={handleSearch}
                className="px-4 py-2.5 rounded-md text-sm cursor-pointer text-white font-medium"
                style={{ background: 'var(--accent)' }}
              >
                搜索
              </button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {searchResults.map((u) => (
                <div key={u.id} className="flex items-center justify-between p-3 rounded-lg"
                  style={{ background: 'var(--bg-tertiary)' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold"
                      style={{ background: 'var(--accent)', color: '#fff' }}>
                      {u.nickname?.[0] || u.username[0]}
                    </div>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {u.nickname || u.username}
                    </span>
                  </div>
                  <button
                    onClick={() => handleStartChat(u.id)}
                    className="px-3 py-1.5 rounded-md text-xs cursor-pointer font-medium text-white"
                    style={{ background: 'var(--accent)' }}
                  >
                    聊天
                  </button>
                </div>
              ))}
              {searchResults.length === 0 && searchQuery && (
                <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>未找到用户</p>
              )}
            </div>
            </div>
          </div>
        </div>
        </Portal>
      )}

      {/* 创建群聊弹窗 */}
      {showCreateGroup && (
        <Portal>
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowCreateGroup(false); setGroupName(''); setSelectedMembers([]); } }}>
          <div className="animate-fade-in w-[420px] rounded-xl"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}>
            <div className="flex items-center justify-between p-5 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>创建群聊</h3>
              <button
                onClick={() => { setShowCreateGroup(false); setGroupName(''); setSelectedMembers([]); }}
                className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
                style={{ color: 'var(--text-secondary)' }}
                {...hoverHandlers()}
              >
                <CloseIcon size={16} />
              </button>
            </div>
            <div className="p-5">
              <div className="mb-4">
                <label className="block text-xs font-medium mb-1.5 ml-1" style={{ color: 'var(--text-secondary)' }}>群名称</label>
              <input
                type="text"
                placeholder="请输入群名称"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-md outline-none text-sm"
                style={inputStyle}
              />
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium mb-1.5 ml-1" style={{ color: 'var(--text-secondary)' }}>添加成员</label>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  placeholder="搜索用户"
                  value={groupSearchQuery}
                  onChange={(e) => setGroupSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGroupSearch()}
                  className="flex-1 px-3.5 py-2.5 rounded-md outline-none text-sm"
                  style={inputStyle}
                />
                <button
                  onClick={handleGroupSearch}
                  className="px-4 py-2.5 rounded-md text-sm cursor-pointer"
                  style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                >搜索</button>
              </div>
              {selectedMembers.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {selectedMembers.map((id) => (
                    <span key={id} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs"
                      style={{ background: 'var(--accent)', color: '#fff' }}>
                      {id.slice(0, 6)}...
                      <button onClick={() => toggleMember(id)} className="cursor-pointer hover:opacity-70">
                        <CloseIcon size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {groupSearchResults.map((u) => {
                  const isSelected = selectedMembers.includes(u.id);
                  return (
                    <div key={u.id}
                      onClick={() => toggleMember(u.id)}
                      className="flex items-center justify-between p-2.5 rounded-lg cursor-pointer"
                      style={{
                        background: isSelected ? 'rgba(59,130,246,0.08)' : 'var(--bg-tertiary)',
                        border: isSelected ? '1px solid var(--accent)' : '1px solid transparent',
                      }}>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                          style={{ background: 'var(--accent)', color: '#fff' }}>
                          {u.nickname?.[0] || u.username[0]}
                        </div>
                        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{u.nickname || u.username}</span>
                      </div>
                      {isSelected && (
                        <CheckIcon size={16} className="text-[var(--accent)]" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <button
              onClick={handleCreateGroup}
              disabled={!groupName.trim() || selectedMembers.length === 0}
              className="w-full py-2.5 rounded-md text-sm font-medium cursor-pointer text-white"
              style={{
                background: groupName.trim() && selectedMembers.length > 0
                  ? 'var(--accent)'
                  : 'var(--bg-tertiary)',
                color: groupName.trim() && selectedMembers.length > 0 ? '#fff' : 'var(--text-muted)',
              }}
            >
              创建群聊 ({selectedMembers.length} 人)
            </button>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  );
}
