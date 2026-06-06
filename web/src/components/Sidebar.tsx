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
  const conversations = useChatStore((s) => s.conversations);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [showSearch, setShowSearch] = useState(false);

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
    <div className="w-16 flex flex-col items-center py-4 gap-4" style={{ background: 'var(--bg-primary)' }}>
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
        style={{ background: 'var(--accent)', color: '#c0e0c0' }}
      >
        {user?.nickname?.[0] || user?.username?.[0] || '?'}
      </div>

      <button
        onClick={() => { fetchConversations(); }}
        className="w-10 h-10 rounded-lg flex items-center justify-center cursor-pointer"
        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
        title="聊天"
      >
        💬
      </button>

      <button
        onClick={() => setShowSearch(true)}
        className="w-10 h-10 rounded-lg flex items-center justify-center cursor-pointer"
        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
        title="添加好友"
      >
        ➕
      </button>

      <div className="flex-1" />

      <button
        onClick={logout}
        className="w-10 h-10 rounded-lg flex items-center justify-center cursor-pointer"
        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
        title="退出登录"
      >
        🚪
      </button>

      {showSearch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="w-80 p-4 rounded-xl" style={{ background: 'var(--bg-secondary)' }}>
            <h3 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>搜索用户</h3>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                placeholder="输入用户名或昵称"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1 px-3 py-2 rounded-lg outline-none text-sm"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
              />
              <button
                onClick={handleSearch}
                className="px-3 py-2 rounded-lg text-sm cursor-pointer"
                style={{ background: 'var(--accent)', color: '#c0e0c0' }}
              >
                搜索
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {searchResults.map((u) => (
                <div key={u.id} className="flex items-center justify-between p-2 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{u.nickname || u.username}</span>
                  <button
                    onClick={() => handleStartChat(u.id)}
                    className="px-2 py-1 rounded text-xs cursor-pointer"
                    style={{ background: 'var(--accent)', color: '#c0e0c0' }}
                  >
                    聊天
                  </button>
                </div>
              ))}
              {searchResults.length === 0 && searchQuery && (
                <p className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>无结果</p>
              )}
            </div>

            <button
              onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]); }}
              className="mt-3 w-full py-2 rounded-lg text-sm cursor-pointer"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
