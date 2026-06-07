import { useState } from 'react';
import { useAuthStore } from '../store/auth';
import { useChatStore } from '../store/chat';
import { useFriendStore } from '../store/friend';
import * as userApi from '../api/users';
import type { User } from '../types';

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
  const totalUnread = useChatStore((s) => s.getTotalUnread)();
  const pendingRequests = useFriendStore((s) => s.getPendingCount)();

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
    const { createConversation } = await import('../api/conversations');
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
    <div className="w-[72px] flex flex-col items-center py-5 gap-2"
      style={{ background: 'var(--bg-primary)', borderRight: '1px solid var(--border)' }}>

      {/* 用户头像 */}
      <div className="relative group cursor-pointer mb-2" onClick={() => onOpenProfile(user?.id || '')}>
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center text-sm font-bold transition-transform group-hover:scale-105"
          style={{
            background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))',
            color: '#fff',
            boxShadow: '0 2px 10px rgba(108, 92, 231, 0.3)',
          }}
        >
          {user?.nickname?.[0] || user?.username?.[0] || '?'}
        </div>
        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2"
          style={{ background: 'var(--success)', borderColor: 'var(--bg-primary)' }} />
      </div>

      <div className="w-8 h-px my-1" style={{ background: 'var(--border)' }} />

      {/* 消息 Tab */}
      <button
        onClick={() => { onTabChange('chat'); fetchConversations(); }}
        className="w-11 h-11 rounded-xl flex items-center justify-center cursor-pointer relative"
        style={{
          background: activeTab === 'chat' ? 'var(--accent)' : 'transparent',
          color: activeTab === 'chat' ? '#fff' : 'var(--text-secondary)',
        }}
        onMouseEnter={(e) => { if (activeTab !== 'chat') e.currentTarget.style.background = 'var(--bg-hover)'; }}
        onMouseLeave={(e) => { if (activeTab !== 'chat') e.currentTarget.style.background = 'transparent'; }}
        title="消息"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {totalUnread > 0 && activeTab !== 'chat' && (
          <div className="absolute -top-1 -right-1 min-w-[16px] h-[16px] rounded-full flex items-center justify-center text-[9px] font-bold px-0.5"
            style={{ background: 'var(--danger)', color: '#fff' }}>
            {totalUnread > 99 ? '99+' : totalUnread}
          </div>
        )}
      </button>

      {/* 联系人 Tab */}
      <button
        onClick={() => onTabChange('contacts')}
        className="w-11 h-11 rounded-xl flex items-center justify-center cursor-pointer relative"
        style={{
          background: activeTab === 'contacts' ? 'var(--accent)' : 'transparent',
          color: activeTab === 'contacts' ? '#fff' : 'var(--text-secondary)',
        }}
        onMouseEnter={(e) => { if (activeTab !== 'contacts') e.currentTarget.style.background = 'var(--bg-hover)'; }}
        onMouseLeave={(e) => { if (activeTab !== 'contacts') e.currentTarget.style.background = 'transparent'; }}
        title="联系人"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        {pendingRequests > 0 && activeTab !== 'contacts' && (
          <div className="absolute -top-1 -right-1 min-w-[16px] h-[16px] rounded-full flex items-center justify-center text-[9px] font-bold px-0.5"
            style={{ background: 'var(--danger)', color: '#fff' }}>
            {pendingRequests}
          </div>
        )}
      </button>

      {/* 添加好友 */}
      <button
        onClick={() => setShowSearch(true)}
        className="w-11 h-11 rounded-xl flex items-center justify-center cursor-pointer"
        style={{ color: 'var(--text-secondary)' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        title="添加好友"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="8.5" cy="7" r="4" />
          <line x1="20" y1="8" x2="20" y2="14" />
          <line x1="23" y1="11" x2="17" y2="11" />
        </svg>
      </button>

      {/* 创建群聊 */}
      <button
        onClick={() => setShowCreateGroup(true)}
        className="w-11 h-11 rounded-xl flex items-center justify-center cursor-pointer"
        style={{ color: 'var(--text-secondary)' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        title="创建群聊"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      </button>

      <div className="flex-1" />

      {/* 退出 */}
      <button
        onClick={logout}
        className="w-11 h-11 rounded-xl flex items-center justify-center cursor-pointer"
        style={{ color: 'var(--text-muted)' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,107,107,0.1)'; e.currentTarget.style.color = 'var(--danger)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
        title="退出登录"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      </button>

      {/* 搜索用户弹窗 */}
      {showSearch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowSearch(false); setSearchQuery(''); setSearchResults([]); } }}>
          <div className="animate-fade-in w-[380px] p-6 rounded-2xl"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>搜索用户</h3>
              <button
                onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]); }}
                className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="输入用户名或昵称"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1 px-3 py-2.5 rounded-xl outline-none text-sm"
                style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                autoFocus
              />
              <button
                onClick={handleSearch}
                className="px-4 py-2.5 rounded-xl text-sm cursor-pointer text-white font-medium"
                style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))' }}
              >
                搜索
              </button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {searchResults.map((u) => (
                <div key={u.id} className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: 'var(--bg-tertiary)' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold"
                      style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))', color: '#fff' }}>
                      {u.nickname?.[0] || u.username[0]}
                    </div>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {u.nickname || u.username}
                    </span>
                  </div>
                  <button
                    onClick={() => handleStartChat(u.id)}
                    className="px-3 py-1.5 rounded-lg text-xs cursor-pointer font-medium"
                    style={{ background: 'var(--accent)', color: '#fff' }}
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
      )}

      {/* 创建群聊弹窗 */}
      {showCreateGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowCreateGroup(false); setGroupName(''); setSelectedMembers([]); } }}>
          <div className="animate-fade-in w-[420px] p-6 rounded-2xl"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>创建群聊</h3>
              <button
                onClick={() => { setShowCreateGroup(false); setGroupName(''); setSelectedMembers([]); }}
                className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium mb-1.5 ml-1" style={{ color: 'var(--text-secondary)' }}>群名称</label>
              <input
                type="text"
                placeholder="请输入群名称"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl outline-none text-sm"
                style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
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
                  className="flex-1 px-3 py-2 rounded-xl outline-none text-sm"
                  style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                />
                <button
                  onClick={handleGroupSearch}
                  className="px-3 py-2 rounded-xl text-sm cursor-pointer"
                  style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                >搜索</button>
              </div>
              {selectedMembers.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {selectedMembers.map((id) => (
                    <span key={id} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
                      style={{ background: 'var(--accent)', color: '#fff' }}>
                      {id.slice(0, 6)}...
                      <button onClick={() => toggleMember(id)} className="cursor-pointer hover:opacity-70">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
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
                      className="flex items-center justify-between p-2.5 rounded-xl cursor-pointer"
                      style={{ background: isSelected ? 'rgba(108,92,231,0.15)' : 'var(--bg-tertiary)', border: isSelected ? '1px solid var(--accent)' : '1px solid transparent' }}>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                          style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))', color: '#fff' }}>
                          {u.nickname?.[0] || u.username[0]}
                        </div>
                        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{u.nickname || u.username}</span>
                      </div>
                      {isSelected && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <button
              onClick={handleCreateGroup}
              disabled={!groupName.trim() || selectedMembers.length === 0}
              className="w-full py-2.5 rounded-xl text-sm font-medium cursor-pointer text-white"
              style={{
                background: groupName.trim() && selectedMembers.length > 0
                  ? 'linear-gradient(135deg, var(--accent), var(--accent-dark))'
                  : 'var(--bg-tertiary)',
                color: groupName.trim() && selectedMembers.length > 0 ? '#fff' : 'var(--text-muted)',
              }}
            >
              创建群聊 ({selectedMembers.length} 人)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
