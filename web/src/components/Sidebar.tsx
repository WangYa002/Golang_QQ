import { useState } from 'react';
import { useAuthStore } from '../store/auth';
import { useChatStore } from '../store/chat';
import * as userApi from '../api/users';
import type { User } from '../types';

export default function Sidebar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const fetchConversations = useChatStore((s) => s.fetchConversations);
  const createConvo = useChatStore((s) => s.selectConversation);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'contacts'>('chat');

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    const users = await userApi.searchUsers(searchQuery);
    setSearchResults(users);
  };

  const handleStartChat = async (userId: string) => {
    const { createConversation } = await import('../api/conversations');
    const convo = await createConversation(userId);
    await fetchConversations();
    createConvo(convo.id);
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  return (
    <div className="w-[72px] flex flex-col items-center py-5 gap-2"
      style={{ background: 'var(--bg-primary)', borderRight: '1px solid var(--border)' }}>

      {/* 用户头像 */}
      <div className="relative group cursor-pointer mb-2">
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
        {/* 在线状态指示器 */}
        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2"
          style={{ background: 'var(--success)', borderColor: 'var(--bg-primary)' }} />
      </div>

      {/* 分隔线 */}
      <div className="w-8 h-px my-1" style={{ background: 'var(--border)' }} />

      {/* 聊天按钮 */}
      <button
        onClick={() => { fetchConversations(); setActiveTab('chat'); }}
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

      {/* 弹性空间 */}
      <div className="flex-1" />

      {/* 设置按钮 */}
      <button
        className="w-11 h-11 rounded-xl flex items-center justify-center cursor-pointer"
        style={{ color: 'var(--text-muted)' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        title="设置"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {/* 退出按钮 */}
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
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-lg)',
            }}>
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
    </div>
  );
}
