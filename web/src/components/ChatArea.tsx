import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useChatStore } from '../store/chat';
import { useAuthStore } from '../store/auth';
import { uploadFile } from '../api/client';
import { recallMessage, searchMessages } from '../api/conversations';
import EmojiPicker from './EmojiPicker';
import GroupMembers from './GroupMembers';
import { MessageIcon, UsersIcon, SearchIcon, SendIcon, PaperclipIcon, PhoneIcon, VideoIcon, MoreIcon } from './icons';
import { inputStyle } from '../styles/common';
import { useCallStore } from '../store/call';
import { useUIStore } from '../store/ui';
import type { Message } from '../types';

function shouldShowTimeSeparator(prev: Message | null, curr: Message): boolean {
  if (!prev) return true;
  const diff = new Date(curr.created_at).getTime() - new Date(prev.created_at).getTime();
  return diff > 5 * 60 * 1000;
}

function isSameSender(prev: Message | null, curr: Message): boolean {
  if (!prev) return false;
  return prev.sender_id === curr.sender_id &&
    (new Date(curr.created_at).getTime() - new Date(prev.created_at).getTime()) < 2 * 60 * 1000;
}

function formatTimeSeparator(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

  if (isToday) return time;
  if (isYesterday) return `昨天 ${time}`;
  return `${date.getMonth() + 1}/${date.getDate()} ${time}`;
}

// 头像颜色池
const AVATAR_COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#f97316', '#06b6d4'];
function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

interface Props {
  onOpenProfile: (userId: string) => void;
  send: (type: string, data: unknown) => void;
}

export default function ChatArea({ onOpenProfile, send }: Props) {
  const currentConvoId = useChatStore((s) => s.currentConvoId);
  const messageMap = useChatStore((s) => s.messages);
  const messages = currentConvoId ? (messageMap[currentConvoId] || []) : [];
  const typingUserMap = useChatStore((s) => s.typingUsers);
  const typingUsers = currentConvoId ? (typingUserMap[currentConvoId] || []) : [];
  const conversations = useChatStore((s) => s.conversations);
  const user = useAuthStore((s) => s.user);
  const userNames = useChatStore((s) => s.userNames);
  const onlineUsers = useChatStore((s) => s.onlineUsers);
  const groupDetails = useChatStore((s) => s.groupDetails);
  const fetchGroupDetails = useChatStore((s) => s.fetchGroupDetails);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastTypingRef = useRef<number>(0);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGroupMembers, setShowGroupMembers] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; msgId: string } | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [notice, setNotice] = useState('');

  const openAddFriend = useUIStore((s) => s.openAddFriend);
  const openCreateGroup = useUIStore((s) => s.openCreateGroup);
  const markAsRead = useChatStore((s) => s.markAsRead);
  const clearMessages = useChatStore((s) => s.clearMessages);
  const startCall = useCallStore((s) => s.startCall);

  const showNotice = (text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(''), 2500);
  };

  useEffect(() => {
    useCallStore.getState().setSend(send);
  }, [send]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const currentConvo = conversations.find((c) => c.id === currentConvoId);

  useEffect(() => {
    if (currentConvo?.type === 'group' && currentConvo.group_id) {
      fetchGroupDetails(currentConvo.group_id);
    }
  }, [currentConvo?.group_id]);

  const handleSend = useCallback(() => {
    if (!input.trim() || !currentConvoId) return;
    send('chat', {
      conversation_id: currentConvoId,
      type: 'text',
      content: input.trim(),
    });
    setInput('');
  }, [input, currentConvoId, send]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (input.trim() && currentConvoId) {
      const now = Date.now();
      if (now - lastTypingRef.current > 2000) {
        lastTypingRef.current = now;
        send('typing', { conversation_id: currentConvoId });
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentConvoId) return;

    try {
      const res = await uploadFile(file);
      const msgType = file.type.startsWith('image/') ? 'image' : 'file';
      send('chat', {
        conversation_id: currentConvoId,
        type: msgType,
        content: res.url,
        metadata: { file_name: file.name, file_size: file.size },
      });
    } catch {
      // upload failed silently
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRecall = async (msgId: string) => {
    if (!currentConvoId) return;
    await recallMessage(currentConvoId, msgId);
    setContextMenu(null);
  };

  const handleContextMenu = (e: React.MouseEvent, msg: Message) => {
    if (msg.sender_id !== user?.id || msg.type === 'system') return;
    if (Date.now() - new Date(msg.created_at).getTime() > 2 * 60 * 1000) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, msgId: msg.id });
  };

  const handleSearch = async () => {
    if (!currentConvoId || !searchQuery.trim()) return;
    const results = await searchMessages(currentConvoId, searchQuery);
    setSearchResults(results);
  };

  const renderMessageContent = (msg: Message) => {
    if (msg.type === 'image') {
      return <img src={msg.content} alt="" className="max-w-[280px] max-h-60 rounded-lg cursor-pointer" style={{ boxShadow: 'var(--shadow-sm)' }} />;
    }
    if (msg.type === 'file' && msg.metadata) {
      return (
        <a href={msg.content} download={msg.metadata.file_name} className="inline-flex items-center gap-2 underline"
          style={{ color: 'var(--accent)' }}>
          <PaperclipIcon size={14} />
          {msg.metadata.file_name} ({((msg.metadata.file_size ?? 0) / 1024).toFixed(1)} KB)
        </a>
      );
    }
    if (msg.type === 'system' || msg.type === 'recalled') {
      return <span className="italic" style={{ color: 'var(--text-muted)' }}>{msg.content}</span>;
    }
    return <span style={{ lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{msg.content}</span>;
  };

  const getConvoName = useMemo(() => {
    if (!currentConvo) return '';
    if (currentConvo.type === 'group') {
      if (currentConvo.group_id && groupDetails[currentConvo.group_id]) {
        return groupDetails[currentConvo.group_id].name;
      }
      return '群聊';
    }
    const otherId = currentConvo.members.find((m) => m !== user?.id);
    return otherId ? (userNames[otherId] || '私聊') : '私聊';
  }, [currentConvo, groupDetails, userNames, user?.id]);

  const getConvoSubtitle = useMemo(() => {
    if (!currentConvo) return '';
    if (currentConvo.type === 'group' && currentConvo.group_id) {
      const group = groupDetails[currentConvo.group_id];
      if (group) return `${group.members.length} 位成员`;
    }
    return '';
  }, [currentConvo, groupDetails]);

  const getSenderName = useCallback((msg: Message) => {
    if (msg.sender_id === user?.id) return user.nickname || user.username || '我';
    return userNames[msg.sender_id] || '用户';
  }, [user, userNames]);

  const decoratedMessages = useMemo(() => {
    const myId = user?.id;
    return messages.map((msg, index) => {
      const isMine = msg.sender_id === myId;
      const isSystem = msg.type === 'system' || msg.type === 'recalled';
      const prevMsg = index > 0 ? messages[index - 1] : null;
      const showTimeSep = shouldShowTimeSeparator(prevMsg, msg);
      const sameSender = isSameSender(prevMsg, msg);
      const showAvatar = !isMine && !isSystem && !sameSender;
      const isLastOfSender = index === messages.length - 1 || !isSameSender(msg, messages[index + 1] || null);
      const senderName = getSenderName(msg);
      const avatarColor = getAvatarColor(senderName);
      return { msg, isMine, isSystem, showTimeSep, sameSender, showAvatar, isLastOfSender, senderName, avatarColor };
    });
  }, [messages, user?.id, getSenderName]);

  const getOtherOnline = () => {
    if (!currentConvo || currentConvo.type === 'group') return false;
    const otherId = currentConvo.members.find((m) => m !== user?.id);
    return otherId ? !!onlineUsers[otherId] : false;
  };

  if (!currentConvoId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 chat-messages-bg">
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6 animate-float"
          style={{ background: 'var(--bg-tertiary)' }}>
          <MessageIcon size={40} className="text-[var(--text-muted)]" />
        </div>
        <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
          开始新的对话
        </h3>
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
          从左侧选择一个会话，或发起新的聊天
        </p>
        <div className="flex flex-wrap gap-2 justify-center max-w-sm">
          {['👋 你好', '在吗？', '最近怎么样'].map((tip) => (
            <span key={tip} className="px-4 py-2 rounded-full text-sm cursor-pointer"
              style={{
                background: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              {tip}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="chat-content flex-1 flex flex-col" style={{ background: 'var(--bg-secondary)', position: 'relative' }}>

        {/* 顶栏 - 现代深色风格 */}
        <div className="flex items-center justify-between"
          style={{
            height: 64,
            padding: '0 24px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-secondary)',
          }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white"
              style={{
                background: currentConvo?.type === 'group'
                  ? 'linear-gradient(135deg, var(--accent), #6366f1)'
                  : `linear-gradient(135deg, ${getAvatarColor(getConvoName)}, ${getAvatarColor(getConvoName + 'x')})`,
                position: 'relative',
              }}>
              {currentConvo?.type === 'group' ? (
                <UsersIcon size={16} />
              ) : getConvoName[0]?.toUpperCase()}
              {currentConvo?.type === 'private' && getOtherOnline() && (
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
                  style={{ background: 'var(--online)', borderColor: 'var(--bg-secondary)' }} />
              )}
            </div>
            <div>
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)', marginBottom: 2 }}>
                {getConvoName}
              </h2>
              {typingUsers.length > 0 ? (
                <span className="text-xs" style={{ color: 'var(--accent)', animation: 'pulse 1.5s infinite' }}>
                  正在输入...
                </span>
              ) : currentConvo?.type === 'private' && getOtherOnline() ? (
                <span className="text-xs" style={{ color: 'var(--success)' }}>在线</span>
              ) : getConvoSubtitle ? (
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {getConvoSubtitle}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (!currentConvo || currentConvo.type === 'group') {
                  showNotice('群聊暂不支持通话，请使用私聊');
                  return;
                }
                const otherId = currentConvo.members.find((m) => m !== user?.id);
                startCall(currentConvo.id, 'voice', getConvoName, otherId || '');
              }}
              className="w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer chat-action-btn"
              style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none' }}
              title="语音通话">
              <PhoneIcon size={18} />
            </button>
            <button
              onClick={() => {
                if (!currentConvo || currentConvo.type === 'group') {
                  showNotice('群聊暂不支持通话，请使用私聊');
                  return;
                }
                const otherId = currentConvo.members.find((m) => m !== user?.id);
                startCall(currentConvo.id, 'video', getConvoName, otherId || '');
              }}
              className="w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer chat-action-btn"
              style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none' }}
              title="视频通话">
              <VideoIcon size={18} />
            </button>
            <button className="w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer chat-action-btn"
              style={{ color: showSearch ? 'var(--accent)' : 'var(--text-muted)', background: 'transparent', border: 'none' }}
              onClick={() => setShowSearch(!showSearch)}
              title="搜索消息">
              <SearchIcon size={18} />
            </button>
            {currentConvo?.type === 'group' && currentConvo.group_id && (
              <button className="w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer chat-action-btn"
                style={{ color: showGroupMembers ? 'var(--accent)' : 'var(--text-muted)', background: 'transparent', border: 'none' }}
                onClick={() => setShowGroupMembers(!showGroupMembers)}
                title="群成员">
                <UsersIcon size={18} />
              </button>
            )}
            <div className="relative">
              <button
                onClick={() => setShowMore(!showMore)}
                className="w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer chat-action-btn"
                style={{ color: showMore ? 'var(--accent)' : 'var(--text-muted)', background: 'transparent', border: 'none' }}
                title="更多操作">
                <MoreIcon size={18} />
              </button>
              {showMore && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMore(false)} />
                  <div className="absolute right-0 top-full mt-2 z-50 w-44 py-2 rounded-xl animate-fade-in"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}>
                    <button
                      onClick={() => { openCreateGroup(); setShowMore(false); }}
                      className="w-full px-4 py-2.5 text-left text-sm cursor-pointer"
                      style={{ color: 'var(--text-primary)' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      发起群聊
                    </button>
                    <button
                      onClick={() => { openAddFriend(); setShowMore(false); }}
                      className="w-full px-4 py-2.5 text-left text-sm cursor-pointer"
                      style={{ color: 'var(--text-primary)' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      添加好友
                    </button>
                    <button
                      onClick={() => { if (currentConvoId) markAsRead(currentConvoId); setShowMore(false); }}
                      className="w-full px-4 py-2.5 text-left text-sm cursor-pointer"
                      style={{ color: 'var(--text-primary)' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      标为已读
                    </button>
                    <div className="my-1" style={{ borderTop: '1px solid var(--border)' }} />
                    <button
                      onClick={() => {
                        if (currentConvoId) {
                          clearMessages(currentConvoId);
                          showNotice('已清空当前会话记录（本地）');
                        }
                        setShowMore(false);
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm cursor-pointer"
                      style={{ color: 'var(--danger)' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      清空聊天记录
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 轻提示 */}
        {notice && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[90] px-5 py-2.5 rounded-xl text-sm animate-fade-in"
            style={{ background: 'rgba(17,24,39,0.95)', color: 'var(--text-primary)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}>
            {notice}
          </div>
        )}

        {showSearch && (
          <div className="px-5 py-2 flex gap-2" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
            <input
              type="text"
              placeholder="搜索消息..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1 px-3.5 py-2 rounded-md outline-none text-sm"
              style={inputStyle}
              autoFocus
            />
            <button onClick={handleSearch}
              className="px-4 py-2 rounded-md text-sm cursor-pointer text-white"
              style={{ background: 'var(--accent)' }}>
              搜索
            </button>
          </div>
        )}

        {showSearch && searchResults.length > 0 && (
          <div className="max-h-40 overflow-y-auto px-5 py-2" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-tertiary)' }}>
            {searchResults.map((msg) => (
              <div key={msg.id} className="py-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--text-muted)' }}>
                  {new Date(msg.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                </span>
                {' '}
                <span style={{ color: 'var(--text-primary)' }}>{msg.content}</span>
              </div>
            ))}
          </div>
        )}

        {/* 消息区域 - QQ 点阵背景 */}
        <div className="flex-1 overflow-y-auto chat-messages-bg" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {decoratedMessages.map(({ msg, isMine, isSystem, showTimeSep, showAvatar, isLastOfSender, senderName, avatarColor }) => {
            return (
              <div key={msg.id}>
                {showTimeSep && (
                  <div className="flex items-center justify-center" style={{ margin: '10px 0' }}>
                    <span className="time-divider-tag">
                      {formatTimeSeparator(msg.created_at)}
                    </span>
                  </div>
                )}

                {isSystem && (
                  <div className="flex justify-center py-1">
                    <span className="text-xs px-3 py-1 rounded"
                      style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                      {msg.content}
                    </span>
                  </div>
                )}

                {!isSystem && (
                  <div
                    className={`flex items-start gap-2.5 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}
                    style={{ maxWidth: '70%', alignSelf: isMine ? 'flex-end' : 'flex-start', marginLeft: isMine ? 'auto' : 0 }}
                    onContextMenu={(e) => handleContextMenu(e, msg)}
                  >
                    {showAvatar ? (
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                        style={{ background: `linear-gradient(135deg, ${avatarColor}, ${getAvatarColor(senderName + 'z')})` }}>
                        {senderName[0]?.toUpperCase()}
                      </div>
                    ) : !isMine ? (
                      <div className="w-9 flex-shrink-0" />
                    ) : null}

                    <div className="flex flex-col gap-0.5" style={{ alignItems: isMine ? 'flex-end' : 'flex-start' }}>
                      {!isMine && showAvatar && currentConvo?.type === 'group' && (
                        <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>
                          {senderName}
                        </span>
                      )}

                      <div
                        className="animate-fade-in"
                        style={{
                          background: isMine ? 'linear-gradient(135deg, #3b82f6, #4f46e5)' : 'var(--bubble-other)',
                          borderRadius: isMine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                          padding: '12px 16px',
                          fontSize: 14,
                          lineHeight: 1.5,
                          color: isMine ? '#fff' : 'var(--text-primary)',
                          wordWrap: 'break-word',
                        }}
                      >
                        {renderMessageContent(msg)}
                      </div>

                      {isLastOfSender && (
                        <span className="text-[11px] mt-1"
                          style={{ color: 'var(--text-muted)', marginLeft: isMine ? 'auto' : 0 }}>
                          {new Date(msg.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                          {isMine && msg.read_by && msg.read_by.length > 1 && (
                            <span className="ml-2">已读 {msg.read_by.length - 1}</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {contextMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
            <div className="fixed z-50 py-1 rounded-lg"
              style={{
                left: contextMenu.x,
                top: contextMenu.y,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-lg)',
                minWidth: 120,
              }}>
              <button
                onClick={() => handleRecall(contextMenu.msgId)}
                className="w-full px-4 py-2 text-left text-sm cursor-pointer"
                style={{ color: 'var(--danger)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                撤回
              </button>
            </div>
          </>
        )}

        {/* 输入区域 - 现代深色风格 */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          <div className="flex gap-2 mb-2">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileUpload}
            />
            <div className="relative">
              <button
                onClick={() => setShowEmoji(!showEmoji)}
                className="toolbar-btn"
                title="表情">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              {showEmoji && (
                <EmojiPicker
                  onSelect={(emoji) => setInput((prev) => prev + emoji)}
                  onClose={() => setShowEmoji(false)}
                />
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="toolbar-btn"
              title="图片">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="toolbar-btn"
              title="文件">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>
          </div>

          <div className="flex items-end gap-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息..."
              rows={1}
              className="modern-input-box"
              onInput={(e) => {
                const target = e.currentTarget;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 120) + 'px';
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="modern-send-btn"
              title="发送"
            >
              <SendIcon size={20} />
            </button>
          </div>
        </div>
      </div>

      {showGroupMembers && currentConvo?.group_id && groupDetails[currentConvo.group_id] && (
        <GroupMembers
          groupId={currentConvo.group_id}
          ownerId={groupDetails[currentConvo.group_id].owner_id}
          onClose={() => setShowGroupMembers(false)}
          onOpenProfile={onOpenProfile}
        />
      )}

    </>
  );
}
