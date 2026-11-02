import { useEffect, useState } from 'react';
import { getGroupMembers, removeGroupMember } from '../api/groups';
import { useAuthStore } from '../store/auth';
import { avatarSrc } from '../api/client';
import { Avatar } from './ui/Avatar';
import { Confirm } from './ui/Confirm';
import { IconButton } from './ui/IconButton';
import { Button } from './ui/Button';
import { CloseIcon } from './icons';
import type { GroupMemberWithUser } from '../types';

interface Props {
  groupId: string;
  ownerId: string;
  onClose: () => void;
  onOpenProfile: (userId: string) => void;
}

export default function GroupMembers({ groupId, ownerId, onClose, onOpenProfile }: Props) {
  const currentUser = useAuthStore((s) => s.user);
  const [members, setMembers] = useState<GroupMemberWithUser[]>([]);
  const [pendingKick, setPendingKick] = useState<GroupMemberWithUser | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    getGroupMembers(groupId).then((data) => setMembers(data || []));
  }, [groupId]);

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
      onClose();
    } finally {
      setActing(false);
    }
  };

  const isOwner = currentUser?.id === ownerId;
  const sortedMembers = [...members].sort((a, b) => {
    const roleOrder = { owner: 0, admin: 1, member: 2 };
    return (roleOrder[a.role] ?? 2) - (roleOrder[b.role] ?? 2);
  });

  const roleLabel = (role: string) => {
    switch (role) {
      case 'owner': return '群主';
      case 'admin': return '管理员';
      default: return '';
    }
  };

  return (
    <div className="flex w-[280px] flex-col animate-slide-right" style={{ background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border)' }}>

      <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          群成员 ({members.length})
        </h3>
        <IconButton label="关闭" size="sm" onClick={onClose}>
          <CloseIcon size={14} />
        </IconButton>
      </div>

      <div className="flex-1 space-y-1.5 overflow-y-auto p-3">
        {sortedMembers.map((m) => {
          const name = m.user.nickname || m.user.username;
          return (
            <div
              key={m.user_id}
              className="flex cursor-pointer items-center gap-3 rounded-xl p-2.5 hoverable"
              onClick={() => onOpenProfile(m.user_id)}
            >
              <Avatar name={name} src={avatarSrc(m.user.avatar)} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm" style={{ color: 'var(--text-primary)' }}>{name}</span>
                  {roleLabel(m.role) && (
                    <span className="rounded px-1.5 py-0.5 text-[10px]" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                      {roleLabel(m.role)}
                    </span>
                  )}
                </div>
              </div>
              {isOwner && m.role !== 'owner' && (
                <IconButton
                  label="移出群聊"
                  size="sm"
                  danger
                  onClick={(e) => { e.stopPropagation(); setPendingKick(m); }}
                >
                  <CloseIcon size={12} />
                </IconButton>
              )}
            </div>
          );
        })}
      </div>

      {!isOwner && (
        <div className="p-3" style={{ borderTop: '1px solid var(--border)' }}>
          <Button block variant="danger" onClick={() => setConfirmLeave(true)}>退出群聊</Button>
        </div>
      )}

      <Confirm
        open={!!pendingKick}
        title="移出群聊"
        description={<>确定将 <b style={{ color: 'var(--text-primary)' }}>{pendingKick?.user.nickname || pendingKick?.user.username}</b> 移出本群？</>}
        confirmText="移出"
        danger
        loading={acting}
        onConfirm={handleKickConfirm}
        onClose={() => setPendingKick(null)}
      />
      <Confirm
        open={confirmLeave}
        title="退出群聊"
        description={<>退出后将不再接收本群消息。</>}
        confirmText="退出"
        danger
        loading={acting}
        onConfirm={handleLeaveConfirm}
        onClose={() => setConfirmLeave(false)}
      />
    </div>
  );
}
