import { useEffect, useRef, useState, useMemo } from 'react';
import { useChatStore } from '../store/chat';
import { useAuthStore } from '../store/auth';
import { SearchIcon, UsersIcon, MessageIcon } from './icons';
import { inputStyle } from '../styles/common';
import type { Conversation } from '../types';

// 会话头像随机颜色池
const AVATAR_COLORS = ['#fa5151', '#07c160', '#ffb800', '#6a7eff', '#12b7f5', '#ff9d00', '#ff6b6b', '#34c759', '#8e44ad', '#2c3e50', '#c0392b'];
function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

type TabFilter = 'all' | 'private' | 'group';

export default function ConversationList() {
  const conversations = useChatStore((s) => s.conversations);
  const currentConvoId = useChatStore((s) => s.currentConvoId);
  const selectConversation = useChatStore((s) => s.selectConversation);
  const fetchConversations = useChatStore((s) => s.fetchConversations);
  const user = useAuthStore((s) => s.user);
  const onlineUsers = useChatStore((s) => s.onlineUsers);
  const userNames = useChatStore((s) => s.userNames);
  const fetchUserName = useChatStore((s) => s.fetchUserName);
  const groupDetails = useChatStore((s) => s.groupDetails);
  const fetchGroupDetails = useChatStore((s) => s.fetchGroupDetails);
  const unreadCount = useChatStore((s) => s.unreadCount);

  const [filter, setFilter] = useState('');
  const [activeTab, setActiveTab] = useState<TabFilter>('all');

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
      } else if (convo.type === 'group' && convo.group_id) {
        if (!groupDetails[convo.group_id]) {
          fetchGroupDetails(convo.group_id);
        }
      }
    });
  }, [conversations]);

  const getDisplayName = (convo: Conversation) => {
    if (convo.type === 'group' && convo.group_id) {
      const group = groupDetails[convo.group_id];
      return group?.name || '群聊';
    }
    const otherId = getOtherUserId(convo);
    return userNames[otherId] || '私聊';
  };

  const getOtherUserId = (convo: Conversation) => {
    if (!user) return '';
    return convo.members.find((m) => m !== user.id) || '';
  };

  const filteredConversations = useMemo(() => {
    let result = conversations;
    // Tab filter
    if (activeTab === 'private') result = result.filter((c) => c.type === 'private');
    else if (activeTab === 'group') result = result.filter((c) => c.type === 'group');
    // Search filter
    if (filter) {
      const lower = filter.toLowerCase();
      result = result.filter((c) => getDisplayName(c).toLowerCase().includes(lower));
    }
    return result;
  }, [conversations, filter, activeTab, userNames, groupDetails]);

  const privateCount = conversations.filter((c) => c.type === 'private').length;
  const groupCount = conversations.filter((c) => c.type === 'group').length;

  return (
    <div className="conversation-pane flex flex-col"
      style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}>

      {/* 头部：标题 + 搜索 */}
      <div style={{ padding: '20px 20px 0' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>消息</h2>
        <div className="relative mb-3">
          <div className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
            <SearchIcon size={16} />
          </div>
          <input
            type="text"
            placeholder="搜索会话..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 rounded-xl outline-none text-sm"
            style={{ ...inputStyle, background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
          />
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-6 px-5" style={{ borderBottom: '1px solid var(--border)' }}>
        {([
          { key: 'all', label: '全部' },
          { key: 'private', label: '私聊', count: privateCount },
          { key: 'group', label: '群聊', count: groupCount },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`convo-tab ${activeTab === tab.key ? 'active' : ''}`}
          >
            {tab.label}
            {'count' in tab && tab.count > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full text-[11px] font-bold"
                style={{ background: 'var(--danger)', color: '#fff' }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 会话列表 */}
      <div className="flex-1 overflow-y-auto" style={{ padding: 8 }}>
        {filteredConversations.map((convo) => {
          const otherId = getOtherUserId(convo);
          const isOnline = !!onlineUsers[otherId];
          const isActive = convo.id === currentConvoId;
          const displayName = getDisplayName(convo);
          const unread = unreadCount[convo.id] || 0;
          const avatarColor = convo.type === 'group'
            ? 'linear-gradient(135deg, var(--accent), #6366f1)'
            : `linear-gradient(135deg, ${getAvatarColor(displayName)}, ${getAvatarColor(displayName + 'x')})`;

          return (
            <div
              key={convo.id}
              onClick={() => selectConversation(convo.id)}
              className="flex items-center gap-3 rounded-xl cursor-pointer relative"
              style={{
                padding: 12,
                marginBottom: 4,
                background: isActive ? 'var(--bg-active)' : 'transparent',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = isActive ? 'var(--bg-active)' : 'transparent'; }}
            >
              {/* 选中指示条 */}
              {isActive && <div className="convo-active-indicator" />}

              {/* 头像 */}
              <div className="relative flex-shrink-0">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold text-white"
                  style={{ background: avatarColor }}
                >
                  {convo.type === 'group' ? (
                    <UsersIcon size={18} />
                  ) : displayName[0]?.toUpperCase()}
                </div>
                {/* 在线状态 */}
                {convo.type === 'private' && (
                  <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 ${isOnline ? 'online-dot' : 'offline-dot'}`}
                    style={{
                      background: isOnline ? 'var(--online)' : 'var(--offline)',
                      borderColor: 'var(--bg-secondary)',
                    }} />
                )}
                {/* 未读徽章 */}
                {unread > 0 && (
                  <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold px-1"
                    style={{ background: 'var(--danger)', color: '#fff' }}>
                    {unread > 99 ? '99+' : unread}
                  </div>
                )}
              </div>

              {/* 信息 */}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                    {displayName}
                  </span>
                  {convo.last_message && (
                    <span className="text-xs flex-shrink-0 ml-2" style={{ color: 'var(--text-muted)' }}>
                      {new Date(convo.last_message.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                {convo.last_message && (
                  <p className="text-xs truncate"
                    style={{
                      color: unread > 0 ? 'var(--text-secondary)' : 'var(--text-muted)',
                      fontWeight: unread > 0 ? 500 : 400,
                    }}>
                    {convo.last_message.content}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'var(--bg-tertiary)' }}>
              <MessageIcon size={40} className="text-[var(--text-muted)]" />
            </div>
            <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              暂无会话
            </h3>
            <p className="text-sm text-center" style={{ color: 'var(--text-muted)' }}>
              点击左侧 + 按钮开始聊天
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
