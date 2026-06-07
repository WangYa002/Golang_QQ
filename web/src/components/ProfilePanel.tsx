import { useEffect, useState } from 'react';
import { getUser, getMe, updateMe } from '../api/users';
import { uploadFile } from '../api/client';
import { useAuthStore } from '../store/auth';
import { createConversation } from '../api/conversations';
import { useChatStore } from '../store/chat';
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

  const [user, setUser] = useState<User | null>(null);
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (isMe && currentUser) {
        setUser(currentUser);
        setNickname(currentUser.nickname);
        setBio(currentUser.bio || '');
        setLoading(false);
      } else {
        const u = await getUser(userId);
        setUser(u);
        setLoading(false);
      }
    };
    load();
  }, [userId]);

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
      <div className="w-[320px] flex items-center justify-center"
        style={{ background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border)' }}>
        <div className="animate-spin w-6 h-6 rounded-full border-2 border-t-transparent"
          style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="w-[320px] flex flex-col animate-slide-right"
      style={{ background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border)' }}>

      <div className="p-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--border)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {isMe ? '个人资料' : '用户资料'}
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

      <div className="p-6 text-center">
        <div className="relative inline-block group">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto overflow-hidden"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))', color: '#fff' }}>
            {user.avatar ? (
              <img src={user.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              user.nickname?.[0]?.toUpperCase() || user.username[0]?.toUpperCase()
            )}
          </div>
          {isMe && editing && (
            <label className="absolute inset-0 flex items-center justify-center rounded-2xl cursor-pointer"
              style={{ background: 'rgba(0,0,0,0.5)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </label>
          )}
        </div>

        {editing ? (
          <div className="mt-4 space-y-3">
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full px-3 py-2 rounded-xl outline-none text-sm text-center"
              style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
              placeholder="昵称"
            />
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full px-3 py-2 rounded-xl outline-none text-sm resize-none"
              style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
              placeholder="个性签名"
              rows={3}
            />
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="flex-1 py-2 rounded-xl text-sm font-medium text-white cursor-pointer"
                style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))' }}>
                保存
              </button>
              <button
                onClick={() => setEditing(false)}
                className="flex-1 py-2 rounded-xl text-sm cursor-pointer"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                取消
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="mt-4 text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              {user.nickname || user.username}
            </h2>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>@{user.username}</p>
            {user.bio && (
              <p className="mt-3 text-sm px-2" style={{ color: 'var(--text-secondary)' }}>{user.bio}</p>
            )}

            {isMe ? (
              <button
                onClick={() => setEditing(true)}
                className="mt-4 px-6 py-2 rounded-xl text-sm font-medium cursor-pointer"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                编辑资料
              </button>
            ) : (
              <button
                onClick={handleStartChat}
                className="mt-4 px-6 py-2 rounded-xl text-sm font-medium text-white cursor-pointer"
                style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))' }}>
                发送消息
              </button>
            )}
          </>
        )}
      </div>

      {!editing && user.email && (
        <div className="px-6">
          <div className="flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{user.email}</span>
          </div>
        </div>
      )}
    </div>
  );
}
