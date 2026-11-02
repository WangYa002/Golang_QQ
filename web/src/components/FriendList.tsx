import { useEffect, useState } from 'react';
import { useFriendStore } from '../store/friend';
import { useChatStore } from '../store/chat';
import { createConversation } from '../api/conversations';
import { avatarSrc } from '../api/client';
import { SearchIcon } from './icons';
import { Avatar } from './ui/Avatar';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import Portal from './Portal';

interface Props {
  onOpenProfile: (userId: string) => void;
  onEnterChat: () => void;
}

export default function FriendList({ onOpenProfile, onEnterChat }: Props) {
  const friends = useFriendStore((s) => s.friends);
  const requests = useFriendStore((s) => s.requests);
  const fetchFriends = useFriendStore((s) => s.fetchFriends);
  const fetchRequests = useFriendStore((s) => s.fetchRequests);
  const acceptRequest = useFriendStore((s) => s.acceptRequest);
  const rejectRequest = useFriendStore((s) => s.rejectRequest);
  const removeFriend = useFriendStore((s) => s.removeFriend);
  const onlineUsers = useChatStore((s) => s.onlineUsers);
  const fetchConversations = useChatStore((s) => s.fetchConversations);
  const selectConversation = useChatStore((s) => s.selectConversation);
  const conversations = useChatStore((s) => s.conversations);
  const groupDetails = useChatStore((s) => s.groupDetails);
  const fetchGroupDetails = useChatStore((s) => s.fetchGroupDetails);

  const [filter, setFilter] = useState('');
  const [contextMenu, setContextMenu] = useState<{ friendId: string; userId: string; x: number; y: number } | null>(null);

  useEffect(() => { fetchFriends(); fetchRequests(); }, []);

  // 群聊列表：取自己所在的群会话，并补齐群资料（名称/人数）
  const groupConvs = conversations.filter((c) => c.type === 'group' && c.group_id);
  useEffect(() => {
    groupConvs.forEach((c) => {
      if (c.group_id && !groupDetails[c.group_id]) fetchGroupDetails(c.group_id);
    });
  }, [groupConvs.map((c) => c.group_id).join(',')]);

  const groupName = (groupId: string) => groupDetails[groupId]?.name || '群聊';
  const openGroup = (conversationId: string) => {
    selectConversation(conversationId);
    onEnterChat();
  };

  const filteredGroups = filter
    ? groupConvs.filter((c) => groupName(c.group_id!).toLowerCase().includes(filter.toLowerCase()))
    : groupConvs;

  const filteredFriends = filter
    ? friends.filter((f) =>
        (f.remark || f.user.nickname || f.user.username).toLowerCase().includes(filter.toLowerCase()),
      )
    : friends;

  const handleStartChat = async (userId: string) => {
    const convo = await createConversation(userId);
    await fetchConversations();
    selectConversation(convo.id);
    onEnterChat();
  };

  const handleContextMenu = (e: React.MouseEvent, friendId: string, userId: string) => {
    e.preventDefault();
    setContextMenu({ friendId, userId, x: e.clientX, y: e.clientY });
  };

  return (
    <div className="contacts-pane flex flex-col" style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}>

      <div className="p-4 pb-3">
        <h2 className="panel-title mb-3">联系人</h2>
        <Input
          className="w-full"
          prefix={<SearchIcon size={14} />}
          placeholder="搜索联系人..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {requests.length > 0 && (
        <div className="px-3 pb-2">
          <div className="mb-2 flex items-center gap-1.5 px-1 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
            好友申请
            <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ background: 'var(--danger)' }}>
              {requests.length}
            </span>
          </div>
          <div className="space-y-1">
            {requests.map((req) => {
              const name = req.from_user.nickname || req.from_user.username;
              return (
                <div key={req.id} className="flex items-center gap-2.5 rounded-lg p-2.5" style={{ background: 'var(--bg-tertiary)' }}>
                  <Avatar name={name} src={avatarSrc(req.from_user.avatar)} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{name}</div>
                  </div>
                  <Button size="sm" variant="primary" onClick={() => acceptRequest(req.id)}>同意</Button>
                  <Button size="sm" variant="ghost" onClick={() => rejectRequest(req.id)}>忽略</Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 群聊（点击直达群会话） */}
      {filteredGroups.length > 0 && (
        <>
          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>群聊</span>
            <span className="rounded-full px-2 py-0.5 text-xs" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
              {filteredGroups.length}
            </span>
          </div>
          <div className="overflow-y-auto px-3 pb-2" style={{ maxHeight: 280 }}>
            {filteredGroups.map((c) => {
              const name = groupName(c.group_id!);
              const members = groupDetails[c.group_id!]?.members.length;
              return (
                <div
                  key={c.id}
                  onClick={() => openGroup(c.id)}
                  className="mb-1 flex cursor-pointer items-center gap-3 rounded-lg px-3 py-3 hoverable"
                >
                  <Avatar name={name} variant="group" size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{name}</div>
                    {members !== undefined && (
                      <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{members} 位成员</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="flex items-center justify-between px-4 py-2">
        <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>好友</span>
        <span className="rounded-full px-2 py-0.5 text-xs" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
          {friends.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        {filteredFriends.map((f) => {
          const displayName = f.remark || f.user.nickname || f.user.username;
          const isOnline = !!onlineUsers[f.user.id];
          return (
            <div
              key={f.id}
              onClick={() => handleStartChat(f.user.id)}
              onContextMenu={(e) => handleContextMenu(e, f.id, f.user.id)}
              className="mb-1 flex cursor-pointer items-center gap-3 rounded-lg px-3 py-3 hoverable"
            >
              <Avatar name={displayName} src={avatarSrc(f.user.avatar)} size="md" online={isOnline} showOnlineDot />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {displayName}
                  {f.remark && f.user.nickname && (
                    <span className="ml-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>({f.user.nickname})</span>
                  )}
                </div>
                {f.user.bio && <div className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>{f.user.bio}</div>}
              </div>
            </div>
          );
        })}

        {friends.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>暂无好友</p>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>通过搜索添加好友</p>
          </div>
        )}
      </div>

      {contextMenu && (
        <Portal>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div className="menu-box fixed z-50" style={{ left: contextMenu.x, top: contextMenu.y }}>
            <button onClick={() => { handleStartChat(contextMenu.userId); setContextMenu(null); }} className="menu-item">
              发送消息
            </button>
            <button onClick={() => { onOpenProfile(contextMenu.userId); setContextMenu(null); }} className="menu-item">
              查看资料
            </button>
            <div className="menu-divider" />
            <button onClick={() => { removeFriend(contextMenu.friendId); setContextMenu(null); }} className="menu-item is-danger">
              删除好友
            </button>
          </div>
        </Portal>
      )}
    </div>
  );
}
