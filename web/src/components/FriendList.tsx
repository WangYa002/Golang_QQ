import { useEffect, useState } from 'react';
import { useFriendStore } from '../store/friend';
import { useChatStore } from '../store/chat';
import { createConversation } from '../api/conversations';
import { SearchIcon } from './icons';
import { hoverHandlers } from '../styles/common';

// 头像颜色池 - 深色主题优化
const AVATAR_COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#f97316', '#06b6d4'];
function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

interface Props {
  onOpenProfile: (userId: string) => void;
}

export default function FriendList({ onOpenProfile }: Props) {
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

  const [filter, setFilter] = useState('');
  const [contextMenu, setContextMenu] = useState<{ friendId: string; userId: string; x: number; y: number } | null>(null);

  useEffect(() => { fetchFriends(); fetchRequests(); }, []);

  const filteredFriends = filter
    ? friends.filter((f) =>
        (f.remark || f.user.nickname || f.user.username).toLowerCase().includes(filter.toLowerCase())
      )
    : friends;

  const handleStartChat = async (userId: string) => {
    const convo = await createConversation(userId);
    await fetchConversations();
    selectConversation(convo.id);
  };

  const handleContextMenu = (e: React.MouseEvent, friendId: string, userId: string) => {
    e.preventDefault();
    setContextMenu({ friendId, userId, x: e.clientX, y: e.clientY });
  };

  return (
    <div className="contacts-pane flex flex-col"
      style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}>

      {/* 头部标题 + 搜索 */}
      <div className="p-4 pb-3">
        <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>联系人</h2>
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
            <SearchIcon size={14} />
          </div>
          <input
            type="text"
            placeholder="搜索联系人..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 rounded-xl outline-none text-sm"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
          />
        </div>
      </div>

      {/* 好友申请 */}
      {requests.length > 0 && (
        <div className="px-3 pb-2">
          <div className="text-xs font-semibold mb-2 px-1 flex items-center gap-1.5"
            style={{ color: 'var(--text-muted)' }}>
            好友申请
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white"
              style={{ background: 'var(--danger)' }}>
              {requests.length}
            </span>
          </div>
          <div className="space-y-1">
            {requests.map((req) => {
              const name = req.from_user.nickname || req.from_user.username;
              return (
                <div key={req.id} className="p-2.5 rounded-lg flex items-center gap-2.5"
                  style={{ background: 'var(--bg-tertiary)' }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${getAvatarColor(name)}, ${getAvatarColor(name + 'z')})` }}>
                    {name[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                      {name}
                    </div>
                  </div>
                  <button
                    onClick={() => acceptRequest(req.id)}
                    className="px-3 py-1.5 rounded-md text-xs cursor-pointer font-medium text-white min-h-[28px]"
                    style={{ background: 'var(--accent)' }}>
                    同意
                  </button>
                  <button
                    onClick={() => rejectRequest(req.id)}
                    className="px-3 py-1.5 rounded-md text-xs cursor-pointer min-h-[28px]"
                    style={{ color: 'var(--text-muted)' }}>
                    忽略
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 好友标题 */}
      <div className="px-4 py-2 flex items-center justify-between">
        <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
          好友
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
          {friends.length}
        </span>
      </div>

      {/* 好友列表 */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {filteredFriends.map((f) => {
          const displayName = f.remark || f.user.nickname || f.user.username;
          const isOnline = !!onlineUsers[f.user.id];
          return (
            <div
              key={f.id}
              onClick={() => handleStartChat(f.user.id)}
              onContextMenu={(e) => handleContextMenu(e, f.id, f.user.id)}
              className="flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer mb-1"
              {...hoverHandlers()}
            >
              <div className="relative flex-shrink-0">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white"
                  style={{ background: `linear-gradient(135deg, ${getAvatarColor(displayName)}, ${getAvatarColor(displayName + 'z')})` }}>
                  {displayName[0]?.toUpperCase()}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
                  style={{
                    background: isOnline ? 'var(--online)' : 'var(--offline)',
                    borderColor: 'var(--bg-secondary)',
                  }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                  {displayName}
                  {f.remark && f.user.nickname && (
                    <span className="text-xs ml-1.5" style={{ color: 'var(--text-muted)' }}>({f.user.nickname})</span>
                  )}
                </div>
                {f.user.bio && (
                  <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{f.user.bio}</div>
                )}
              </div>
            </div>
          );
        })}

        {friends.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>暂无好友</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>通过搜索添加好友</p>
          </div>
        )}
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div className="fixed z-50 py-1.5 rounded-lg"
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-lg)',
              minWidth: 140,
            }}>
            <button
              onClick={() => { handleStartChat(contextMenu.userId); setContextMenu(null); }}
              className="w-full px-4 py-2 text-left text-sm cursor-pointer"
              style={{ color: 'var(--text-primary)' }}
              {...hoverHandlers()}
            >
              发送消息
            </button>
            <button
              onClick={() => { onOpenProfile(contextMenu.userId); setContextMenu(null); }}
              className="w-full px-4 py-2 text-left text-sm cursor-pointer"
              style={{ color: 'var(--text-primary)' }}
              {...hoverHandlers()}
            >
              查看资料
            </button>
            <div className="my-1" style={{ borderTop: '1px solid var(--border)' }} />
            <button
              onClick={() => { removeFriend(contextMenu.friendId); setContextMenu(null); }}
              className="w-full px-4 py-2 text-left text-sm cursor-pointer"
              style={{ color: 'var(--danger)' }}
              {...hoverHandlers({ hoverBg: 'rgba(239,68,68,0.08)' })}
            >
              删除好友
            </button>
          </div>
        </>
      )}
    </div>
  );
}
