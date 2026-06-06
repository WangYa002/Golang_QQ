import { useEffect } from 'react';
import { useChatStore } from '../store/chat';
import { useAuthStore } from '../store/auth';
import type { Conversation } from '../types';

export default function ConversationList() {
  const conversations = useChatStore((s) => s.conversations);
  const currentConvoId = useChatStore((s) => s.currentConvoId);
  const selectConversation = useChatStore((s) => s.selectConversation);
  const fetchConversations = useChatStore((s) => s.fetchConversations);
  const user = useAuthStore((s) => s.user);
  const onlineUsers = useChatStore((s) => s.onlineUsers);

  useEffect(() => {
    fetchConversations();
  }, []); // run once on mount

  const getDisplayName = (convo: Conversation) => {
    if (convo.type === 'group' && convo.group_id) return '群聊';
    return '私聊';
  };

  const getOtherUserId = (convo: Conversation) => {
    if (!user) return '';
    return convo.members.find((m) => m !== user.id) || '';
  };

  return (
    <div className="w-72 flex flex-col" style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}>
      <div className="p-3 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
        消息
      </div>

      <div className="flex-1 overflow-y-auto">
        {conversations.map((convo) => {
          const otherId = getOtherUserId(convo);
          const isOnline = !!onlineUsers[otherId];
          const isActive = convo.id === currentConvoId;

          return (
            <div
              key={convo.id}
              onClick={() => selectConversation(convo.id)}
              className="flex items-center gap-3 px-3 py-3 cursor-pointer"
              style={{
                background: isActive ? 'var(--bg-active)' : 'transparent',
                borderLeft: isActive ? '3px solid #81c784' : '3px solid transparent',
              }}
            >
              <div className="relative">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{ background: convo.type === 'group' ? '#5e3a5e' : 'var(--accent)', color: '#d0d0d0' }}
                >
                  {convo.type === 'group' ? '群' : getDisplayName(convo)[0]}
                </div>
                {convo.type === 'private' && isOnline && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full" style={{ background: '#81c784', border: '2px solid var(--bg-secondary)' }} />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {getDisplayName(convo)}
                  </span>
                  {convo.last_message && (
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {new Date(convo.last_message.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                {convo.last_message && (
                  <p className="text-xs truncate mt-1" style={{ color: 'var(--text-secondary)' }}>
                    {convo.last_message.content}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {conversations.length === 0 && (
          <div className="p-4 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
            暂无会话，点击➕开始聊天
          </div>
        )}
      </div>
    </div>
  );
}
