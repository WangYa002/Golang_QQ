import { useEffect, useState } from 'react';
import { getUser, updateMe } from '../api/users';
import { uploadFile, mediaUrl } from '../api/client';
import { useAuthStore } from '../store/auth';
import { createConversation } from '../api/conversations';
import { useChatStore } from '../store/chat';
import { Avatar } from './ui/Avatar';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { IconButton } from './ui/IconButton';
import { CloseIcon, CameraIcon, MailIcon } from './icons';
import type { User } from '../types';

interface Props {
  userId: string;
  onClose: () => void;
}

export default function ProfilePanel({ userId, onClose }: Props) {
  const currentUser = useAuthStore((s) => s.user);
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const fetchConversations = useChatStore((s) => s.fetchConversations);
  const selectConversation = useChatStore((s) => s.selectConversation);
  const isMe = userId === currentUser?.id;

  const [otherUser, setOtherUser] = useState<User | null>(null);
  const user = isMe ? currentUser ?? null : otherUser;
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState(currentUser?.nickname ?? '');
  const [bio, setBio] = useState(currentUser?.bio ?? '');
  const [loading, setLoading] = useState(!isMe);

  useEffect(() => {
    if (isMe) return;
    let cancelled = false;
    getUser(userId)
      .then((loaded) => { if (!cancelled) setOtherUser(loaded); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isMe, userId]);

  const handleSave = async () => {
    await updateMe({ nickname, bio });
    await fetchMe();
    setEditing(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await uploadFile(file);
    await updateMe({ avatar: res.url });
    await fetchMe();
  };

  const handleStartChat = async () => {
    const convo = await createConversation(userId);
    await fetchConversations();
    selectConversation(convo.id);
    onClose();
  };

  if (loading) {
    return (
      <div className="flex w-[320px] items-center justify-center" style={{ background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border)' }}>
        <div className="animate-spin h-6 w-6 rounded-full border-2" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!user) return null;
  const displayName = user.nickname || user.username;

  return (
    <div className="flex w-[320px] flex-col animate-slide-right" style={{ background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border)' }}>

      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {isMe ? '个人资料' : '用户资料'}
        </h3>
        <IconButton label="关闭" size="sm" onClick={onClose}>
          <CloseIcon size={14} />
        </IconButton>
      </div>

      <div className="px-6 py-5 text-center">
        <div className="group relative inline-block">
          <Avatar name={displayName} src={user.avatar ? mediaUrl(user.avatar) : undefined} size="lg" />
          {isMe && editing && (
            <label className="absolute inset-0 flex cursor-pointer items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)', borderRadius: '50%' }}>
              <CameraIcon size={20} className="text-white" />
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </label>
          )}
        </div>

        {editing ? (
          <div className="mt-4 space-y-3">
            <Input className="w-full text-center" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="昵称" />
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full resize-none"
              style={{
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 14px',
                fontSize: 14,
                outline: 'none',
              }}
              placeholder="个性签名"
              rows={3}
            />
            <div className="flex gap-2">
              <Button block variant="primary" onClick={handleSave}>保存</Button>
              <Button block variant="secondary" onClick={() => setEditing(false)}>取消</Button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="mt-4 text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{displayName}</h2>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>@{user.username}</p>
            {user.bio && <p className="mt-3 px-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{user.bio}</p>}

            {isMe ? (
              <Button variant="secondary" className="mt-4" icon={undefined} onClick={() => setEditing(true)}>编辑资料</Button>
            ) : (
              <Button variant="primary" className="mt-4" onClick={handleStartChat}>发送消息</Button>
            )}
          </>
        )}
      </div>

      {!editing && user.email && (
        <div className="px-6">
          <div className="flex items-center gap-3">
            <MailIcon size={16} className="text-[var(--text-muted)]" />
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{user.email}</span>
          </div>
        </div>
      )}
    </div>
  );
}
