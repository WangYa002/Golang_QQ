import { useEffect, useState } from 'react';
import { getGroupMembers, removeGroupMember } from '../api/groups';
import { useAuthStore } from '../store/auth';
import type { GroupMemberWithUser } from '../types';

const AVATAR_COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#f97316', '#06b6d4'];
function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

interface Props {
  groupId: string;
  ownerId: string;
  onClose: () => void;
  onOpenProfile: (userId: string) => void;
}

export default function GroupMembers({ groupId, ownerId, onClose, onOpenProfile }: Props) {
  const currentUser = useAuthStore((s) => s.user);
  const [members, setMembers] = useState<GroupMemberWithUser[]>([]);

  useEffect(() => {
    getGroupMembers(groupId).then((data) => setMembers(data || []));
  }, [groupId]);

  const handleKick = async (userId: string) => {
    await removeGroupMember(groupId, userId);
    setMembers((prev) => prev.filter((m) => m.user_id !== userId));
  };

  const handleLeave = async () => {
    await removeGroupMember(groupId, currentUser!.id);
    onClose();
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
    <div className="w-[280px] flex flex-col animate-slide-right"
      style={{ background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border)' }}>

      <div className="p-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--border)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          群成员 ({members.length})
        </h3>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {sortedMembers.map((m) => (
          <div key={m.user_id}
            className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer"
            onClick={() => onOpenProfile(m.user_id)}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 text-white"
              style={{ background: `linear-gradient(135deg, ${getAvatarColor(m.user.nickname || m.user.username)}, ${getAvatarColor((m.user.nickname || m.user.username) + 'z')})` }}>
              {m.user.nickname?.[0] || m.user.username[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                  {m.user.nickname || m.user.username}
                </span>
                {roleLabel(m.role) && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{ background: 'var(--accent)', color: '#fff' }}>
                    {roleLabel(m.role)}
                  </span>
                )}
              </div>
            </div>
            {isOwner && m.role !== 'owner' && (
              <button
                onClick={(e) => { e.stopPropagation(); handleKick(m.user_id); }}
                className="w-6 h-6 rounded flex items-center justify-center cursor-pointer"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => { e.stopPropagation(); e.currentTarget.style.color = 'var(--danger)'; }}
                onMouseLeave={(e) => { e.stopPropagation(); e.currentTarget.style.color = 'var(--text-muted)'; }}
                title="移出群聊">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>

      {!isOwner && (
        <div className="p-3" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={handleLeave}
            className="w-full py-2 rounded-xl text-sm cursor-pointer font-medium"
            style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.2)' }}>
            退出群聊
          </button>
        </div>
      )}
    </div>
  );
}
