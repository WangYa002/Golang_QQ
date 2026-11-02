import { useEffect, useMemo, useState } from 'react';
import { getGroupMembers, removeGroupMember } from '../api/groups';
import { useAuthStore } from '../store/auth';
import { useChatStore } from '../store/chat';
import { avatarSrc } from '../api/client';
import { Avatar } from './ui/Avatar';
import { Confirm } from './ui/Confirm';
import { IconButton } from './ui/IconButton';
import { Button } from './ui/Button';
import { SearchIcon, CloseIcon, MegaphoneIcon, ChevronDownIcon, ChevronRightIcon } from './icons';
import type { GroupMemberWithUser } from '../types';

interface Props {
  groupId: string;
  ownerId: string;
  onOpenProfile: (userId: string) => void;
  /** 退出群聊成功后由父组件收起面板并刷新会话 */
  onLeft?: () => void;
}

const roleLabel = (role: string) => {
  switch (role) {
    case 'owner': return '群主';
    case 'admin': return '管理员';
    default: return '';
  }
};

/**
 * 群聊右侧信息面板：群公告（可折叠）+ 群聊成员列表（角色徽章 / 计数 / 搜索）。
 * 对齐参考图中群聊界面的右侧栏。
 */
export default function GroupInfoPanel({ groupId, ownerId, onOpenProfile, onLeft }: Props) {
  const currentUser = useAuthStore((s) => s.user);
  const announcement = useChatStore((s) => s.groupDetails[groupId]?.announcement) || '';
  const [members, setMembers] = useState<GroupMemberWithUser[]>([]);
  const [noticeOpen, setNoticeOpen] = useState(true);
  const [query, setQuery] = useState('');
  // 待确认的危险操作：踢人 / 退群
  const [pendingKick, setPendingKick] = useState<GroupMemberWithUser | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    getGroupMembers(groupId).then((data) => {
      const list = data || [];
      setMembers(list);
      // 顺带把群成员昵称写入 userNames，供聊天区显示发送者昵称
      list.forEach((m) => useChatStore.getState().fetchUserName(m.user_id));
    });
  }, [groupId]);

  const sorted = useMemo(() => [...members].sort((a, b) => {
    const order = { owner: 0, admin: 1, member: 2 };
    return (order[a.role] ?? 2) - (order[b.role] ?? 2);
  }), [members]);

  const filtered = query
    ? sorted.filter((m) => (m.user.nickname || m.user.username).toLowerCase().includes(query.toLowerCase()))
    : sorted;

  const handleKickConfirm = async () => {
    if (!pendingKick) return;
    setActing(true);
    try {
      await removeGroupMember(groupId, pendingKick.user_id);
      setMembers((prev) => prev.filter((m) => m.user_id !== pendingKick.user_id));
      setPendingKick(null);
    } finally {
      setActing(false);
    }
  };

  const handleLeaveConfirm = async () => {
    if (!currentUser) return;
    setActing(true);
    try {
      await removeGroupMember(groupId, currentUser.id);
      setConfirmLeave(false);
      await useChatStore.getState().fetchConversations();
      onLeft?.();
    } finally {
      setActing(false);
    }
  };

  const isOwner = currentUser?.id === ownerId;

  return (
    <div className="group-info-panel">
      {/* 群公告（贴合信息栏上方，点击在本栏下方展开/收起） */}
      <div className="group-notice">
        <button className="group-notice-head" onClick={() => setNoticeOpen((v) => !v)}>
          <MegaphoneIcon size={14} />
          <span>群公告</span>
          {noticeOpen ? <ChevronDownIcon size={14} /> : <ChevronRightIcon size={14} />}
        </button>
        {noticeOpen && (
          <div className="group-notice-body">
            {announcement || '暂无公告'}
          </div>
        )}
      </div>

      {/* 群成员 */}
      <div className="group-members-head">
        <span className="group-members-title">群聊成员 {members.length}</span>
        <IconButton label="搜索成员" size="sm">
          <SearchIcon size={14} />
        </IconButton>
      </div>

      {query && (
        <div className="group-member-search">
          <input
            className="input-like w-full"
            placeholder="搜索成员..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}

      <div className="group-members-list">
        {filtered.map((m) => {
          const name = m.user.nickname || m.user.username;
          const role = roleLabel(m.role);
          return (
            <div
              key={m.user_id}
              className="group-member-row"
              onClick={() => onOpenProfile(m.user_id)}
            >
              <Avatar name={name} src={avatarSrc(m.user.avatar)} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="group-member-name">{name}</span>
                  {role && (
                    <span className={`group-role-badge ${m.role === 'owner' ? 'is-owner' : ''}`}>{role}</span>
                  )}
                </div>
              </div>
              {isOwner && m.role !== 'owner' && (
                <IconButton label="移出群聊" size="sm" danger onClick={(e) => { e.stopPropagation(); setPendingKick(m); }}>
                  <CloseIcon size={12} />
                </IconButton>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>暂无成员</p>
        )}
      </div>

      {!isOwner && (
        <div className="group-leave">
          <Button block variant="danger" onClick={() => setConfirmLeave(true)}>退出群聊</Button>
        </div>
      )}

      <Confirm
        open={!!pendingKick}
        title="移出群聊"
        description={<>确定将 <b style={{ color: 'var(--text-primary)' }}>{pendingKick?.user.nickname || pendingKick?.user.username}</b> 移出本群？该成员需要重新被邀请才能加入。</>}
        confirmText="移出"
        danger
        loading={acting}
        onConfirm={handleKickConfirm}
        onClose={() => setPendingKick(null)}
      />
      <Confirm
        open={confirmLeave}
        title="退出群聊"
        description={<>退出后将不再接收本群消息，群聊记录会从会话列表移除。</>}
        confirmText="退出"
        danger
        loading={acting}
        onConfirm={handleLeaveConfirm}
        onClose={() => setConfirmLeave(false)}
      />
    </div>
  );
}
