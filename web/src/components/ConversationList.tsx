import { useEffect, useRef, useState } from 'react';
import { useChatStore } from '../store/chat';
import { useAuthStore } from '../store/auth';
import type { Conversation } from '../types';
import * as userApi from '../api/users';

export default function ConversationList() {
  const conversations = useChatStore((s) => s.conversations);
  const currentConvoId = useChatStore((s) => s.currentConvoId);
  const selectConversation = useChatStore((s) => s.selectConversation);
  const fetchConversations = useChatStore((s) => s.fetchConversations);
  const user = useAuthStore((s) => s.user);
  const onlineUsers = useChatStore((s) => s.onlineUsers);
  const userNames = useChatStore((s) => s.userNames);
  const fetchUserName = useChatStore((s) => s.fetchUserName);

  const [filter, setFilter] = useState('');

  const hasFetchedRef = useRef(false);
  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchConversations();
    }
  }, []);

  useEffect(() => {
    conversations.forEach((convo) => {
      if (convo.type === 'private') {
        const otherId = convo.members.find((m) => m !== user?.id);
        if (otherId && !userNames[otherId]) {
          fetchUserName(otherId);
        }
      }
    });
  }, [conversations]);

  const getDisplayName = (convo: Conversation) => {
    if (convo.type === 'group' && convo.group_id) return '群聊';
    const otherId = getOtherUserId(convo);
    return userNames[otherId] || '私聊';
  };

  const getOtherUserId = (convo: Conversation) => {
    if (!user) return '';
    return convo.members.find((m) => m !== user.id) || '';
  };

  const filteredConversations = filter
    ? conversations.filter((c) => getDisplayName(c).toLowerCase().includes(filter.toLowerCase()))
    : conversations;

  return (
    <div className="w-[300px] flex flex-col"
      style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}>

      {/* 搜索栏 */}
      <div className="p-4 pb-2">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="搜索会话..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 rounded-xl outline-none text-sm"
            style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
          />
        </div>
      </div>

      {/* 标题 */}
      <div className="px-4 py-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          消息
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
          {conversations.length}
        </span>
      </div>

      {/* 会话列表 */}
      <div className="flex-1 overflow-y-auto px-2">
        {filteredConversations.map((convo, index) => {
          const otherId = getOtherUserId(convo);
          const isOnline = !!onlineUsers[otherId];
          const isActive = convo.id === currentConvoId;
          const displayName = getDisplayName(convo);

          return (
            <div
              key={convo.id}
              onClick={() => selectConversation(convo.id)}
              className="animate-fade-in flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer mb-0.5"
              style={{
                background: isActive ? 'var(--bg-active)' : 'transparent',
                animationDelay: `${index * 30}ms`,
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              {/* 头像 */}
              <div className="relative flex-shrink-0">
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center text-sm font-bold"
                  style={{
                    background: convo.type === 'group'
                      ? 'linear-gradient(135deg, #e17055, #d63031)'
                      : 'linear-gradient(135deg, var(--accent), var(--accent-dark))',
                    color: '#fff',
                  }}
                >
                  {convo.type === 'group' ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  ) : displayName[0]?.toUpperCase()}
                </div>
                {/* 在线状态 */}
                {convo.type === 'private' && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2"
                    style={{
                      background: isOnline ? 'var(--success)' : 'var(--text-muted)',
                      borderColor: isActive ? 'var(--bg-active)' : 'var(--bg-secondary)',
                    }} />
                )}
              </div>

              {/* 信息 */}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {displayName}
                  </span>
                  {convo.last_message && (
                    <span className="text-[11px] flex-shrink-0 ml-2" style={{ color: 'var(--text-muted)' }}>
                      {new Date(convo.last_message.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                {convo.last_message && (
                  <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {convo.last_message.content}
                  </p>
                )}
              </div>

              {/* 选中指示器 */}
              {isActive && (
                <div className="absolute left-0 w-[3px] h-8 rounded-r-full"
                  style={{ background: 'var(--accent)' }} />
              )}
            </div>
          );
        })}

        {conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'var(--bg-tertiary)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p className="text-sm text-center" style={{ color: 'var(--text-muted)' }}>
              暂无会话
            </p>
            <p className="text-xs text-center mt-1" style={{ color: 'var(--text-muted)' }}>
              点击左侧 + 按钮开始聊天
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
