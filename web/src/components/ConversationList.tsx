import { useEffect, useRef, useState, useMemo } from 'react';
import { useChatStore } from '../store/chat';
import { useAuthStore } from '../store/auth';
import { SearchIcon, MessageIcon, PinIcon, BellOffIcon, TrashIcon, MoreIcon, PlusIcon } from './icons';
import { Avatar } from './ui/Avatar';
import { avatarSrc } from '../api/client';
import { Input } from './ui/Input';
import { IconButton } from './ui/IconButton';
import { useUIStore } from '../store/ui';
import Portal from './Portal';
import type { Conversation } from '../types';

export default function ConversationList() {
  const conversations = useChatStore((s) => s.conversations);
  const currentConvoId = useChatStore((s) => s.currentConvoId);
  const selectConversation = useChatStore((s) => s.selectConversation);
  const fetchConversations = useChatStore((s) => s.fetchConversations);
  const user = useAuthStore((s) => s.user);
  const onlineUsers = useChatStore((s) => s.onlineUsers);
  const userNames = useChatStore((s) => s.userNames);
  const userAvatars = useChatStore((s) => s.userAvatars);
  const fetchUserName = useChatStore((s) => s.fetchUserName);
  const groupDetails = useChatStore((s) => s.groupDetails);
  const fetchGroupDetails = useChatStore((s) => s.fetchGroupDetails);
  const unreadCount = useChatStore((s) => s.unreadCount);
  const convPrefs = useChatStore((s) => s.convPrefs);
  const setConvPref = useChatStore((s) => s.setConvPref);
  const hideConversation = useChatStore((s) => s.hideConversation);
  const openAddFriend = useUIStore((s) => s.openAddFriend);
  const openCreateGroup = useUIStore((s) => s.openCreateGroup);

  const [filter, setFilter] = useState('');
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number; convoId: string } | null>(null);

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
        if (otherId && !userNames[otherId]) fetchUserName(otherId);
      } else if (convo.type === 'group' && convo.group_id) {
        if (!groupDetails[convo.group_id]) fetchGroupDetails(convo.group_id);
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

  const visibleConversations = useMemo(() => {
    let result = conversations.filter((c) => !convPrefs[c.id]?.hidden);
    if (filter) {
      const lower = filter.toLowerCase();
      result = result.filter((c) => getDisplayName(c).toLowerCase().includes(lower));
    }
    return [...result].sort((a, b) => {
      const pa = convPrefs[a.id]?.pinned ? 1 : 0;
      const pb = convPrefs[b.id]?.pinned ? 1 : 0;
      if (pa !== pb) return pb - pa;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [conversations, filter, convPrefs, userNames, groupDetails]);

  const menuConvo = menu ? conversations.find((c) => c.id === menu.convoId) : null;
  const menuPref = menu ? convPrefs[menu.convoId] : undefined;

  return (
    <div className="conversation-pane flex flex-col" style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}>

      <div style={{ padding: '12px 12px 0' }}>
        <div className="convo-searchbar mb-2">
          <Input
            className="flex-1"
            prefix={<SearchIcon size={16} />}
            placeholder="搜索..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <div className="relative">
            <IconButton
              label="新建"
              size="md"
              className="convo-add"
              active={showAddMenu}
              onClick={() => setShowAddMenu((v) => !v)}
            >
              <PlusIcon size={18} />
            </IconButton>
            {showAddMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowAddMenu(false)} />
                <div className="menu-box absolute right-0 top-full z-50 mt-2 animate-fade-in">
                  <button onClick={() => { openCreateGroup(); setShowAddMenu(false); }} className="menu-item">
                    发起群聊
                  </button>
                  <button onClick={() => { openAddFriend(); setShowAddMenu(false); }} className="menu-item">
                    添加好友
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ padding: 8 }}>
        {visibleConversations.map((convo) => {
          const otherId = getOtherUserId(convo);
          const isOnline = !!onlineUsers[otherId];
          const isActive = convo.id === currentConvoId;
          const displayName = getDisplayName(convo);
          const unread = unreadCount[convo.id] || 0;
          const pref = convPrefs[convo.id];
          const isPinned = !!pref?.pinned;
          const isMuted = !!pref?.muted;

          return (
            <div
              key={convo.id}
              onClick={() => selectConversation(convo.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu({ x: e.clientX, y: e.clientY, convoId: convo.id });
              }}
              className="group relative flex cursor-pointer items-center rounded-xl convo-item"
              style={{ padding: '8px 10px', marginBottom: 1, background: isActive ? 'var(--bg-active)' : undefined }}
            >
              {isActive && <div className="convo-active-indicator" />}

              <div className="relative flex-shrink-0" style={{ marginRight: 10 }}>
                <Avatar
                  name={displayName}
                  variant={convo.type === 'group' ? 'group' : 'user'}
                  src={convo.type === 'private' ? avatarSrc(userAvatars[otherId]) : undefined}
                  size="md"
                  online={isOnline}
                  showOnlineDot={convo.type === 'private'}
                />
                {isMuted && (
                  <div className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2" style={{ background: 'var(--text-muted)', borderColor: 'var(--bg-secondary)' }} />
                )}
                {!isMuted && unread > 0 && (
                  <span className="unread-badge absolute" style={{ top: -6, right: -7 }}>
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between" style={{ marginBottom: 3 }}>
                  <span className="flex min-w-0 items-center gap-1 truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    <span className="truncate">{displayName}</span>
                    {isPinned && <PinIcon size={11} className="flex-shrink-0 opacity-60" />}
                  </span>
                  <span className="ml-2 flex flex-shrink-0 items-center gap-1.5 text-[11px] tnum"
                    style={{ color: unread > 0 && !isMuted ? 'var(--accent)' : 'var(--text-muted)' }}>
                    {isMuted && <BellOffIcon size={11} />}
                    {convo.last_message &&
                      new Date(convo.last_message.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenu({ x: e.clientX, y: e.clientY, convoId: convo.id });
                      }}
                      className="flex h-5 w-5 cursor-pointer items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100"
                      style={{ color: 'var(--text-secondary)' }}
                      title="会话操作"
                    >
                      <MoreIcon size={13} />
                    </button>
                  </span>
                </div>
                {convo.last_message && (
                  <p className="truncate text-xs"
                    style={{ color: unread > 0 ? 'var(--text-secondary)' : 'var(--text-muted)', fontWeight: unread > 0 ? 500 : 400 }}>
                    {convo.last_message.content}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center px-4 py-16">
            <div className="ui-avatar mb-4" style={{ width: 80, height: 80, background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
              <MessageIcon size={40} />
            </div>
            <h3 className="mb-1 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>暂无会话</h3>
            <p className="text-center text-sm" style={{ color: 'var(--text-muted)' }}>点击左侧 + 按钮开始聊天</p>
          </div>
        )}
      </div>

      {menu && menuConvo && (
        <Portal>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setMenu(null); }}
          />
          <div
            className="menu-box fixed z-50 animate-fade-in"
            style={{
              left: Math.min(menu.x, window.innerWidth - 170),
              top: Math.min(menu.y, window.innerHeight - 150),
            }}
          >
            <button onClick={() => { setConvPref(menu.convoId, { pinned: !menuPref?.pinned }); setMenu(null); }} className="menu-item">
              <PinIcon size={14} />
              {menuPref?.pinned ? '取消置顶' : '置顶会话'}
            </button>
            <button onClick={() => { setConvPref(menu.convoId, { muted: !menuPref?.muted }); setMenu(null); }} className="menu-item">
              <BellOffIcon size={14} />
              {menuPref?.muted ? '开启消息提醒' : '消息免打扰'}
            </button>
            <div className="menu-divider" />
            <button onClick={() => { hideConversation(menu.convoId); setMenu(null); }} className="menu-item is-danger">
              <TrashIcon size={14} />
              删除会话
            </button>
          </div>
        </Portal>
      )}
    </div>
  );
}
