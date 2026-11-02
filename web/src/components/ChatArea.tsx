import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useChatStore } from '../store/chat';
import { useAuthStore } from '../store/auth';
import { uploadFile, mediaUrl, avatarSrc } from '../api/client';
import { uuid } from '../api/uuid';
import { recallMessage, searchMessages } from '../api/conversations';
import { getGroupMembers } from '../api/groups';
import EmojiPicker from './EmojiPicker';
import GroupInfoPanel from './GroupInfoPanel';
import AiAssistant from './AiAssistant';
import { Mascot } from './Mascot';
import ScreenshotCrop from './ScreenshotCrop';
import FilePreview from './FilePreview';
import {
  MessageIcon, SearchIcon, SendIcon, PaperclipIcon,
  SmileIcon, ImageIcon, PhoneIcon, VideoIcon, MoreIcon,
  ScreenShareIcon, ScreenshotIcon, MicIcon,
} from './icons';
import { Avatar } from './ui/Avatar';
import { Confirm } from './ui/Confirm';
import { IconButton } from './ui/IconButton';
import { Input } from './ui/Input';
import Portal from './Portal';
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

function isRecentMessage(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() <= 2 * 60 * 1000;
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
  const userAvatars = useChatStore((s) => s.userAvatars);
  const onlineUsers = useChatStore((s) => s.onlineUsers);
  const groupDetails = useChatStore((s) => s.groupDetails);
  const fetchGroupDetails = useChatStore((s) => s.fetchGroupDetails);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastTypingRef = useRef<number>(0);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGroupPanel, setShowGroupPanel] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; msgId: string } | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [notice, setNotice] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  // 截图：抓屏后的完整帧（dataURL），交给框选组件
  const [shotSrc, setShotSrc] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; fileName: string; type: 'image' | 'unknown' } | null>(null);
  // 小Q 浮标：拖动位置（null = 默认右下角）
  const [fabPos, setFabPos] = useState<{ x: number; y: number } | null>(null);
  const [fabDragging, setFabDragging] = useState(false);
  const fabDragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number; moved: boolean } | null>(null);

  const openAddFriend = useUIStore((s) => s.openAddFriend);
  const openCreateGroup = useUIStore((s) => s.openCreateGroup);
  const markAsRead = useChatStore((s) => s.markAsRead);
  const clearMessages = useChatStore((s) => s.clearMessages);
  const startCall = useCallStore((s) => s.startCall);

  const showNotice = (text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(''), 2500);
  };

  useEffect(() => { useCallStore.getState().setSend(send); }, [send]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const currentConvo = conversations.find((c) => c.id === currentConvoId);
  const isGroupChat = currentConvo?.type === 'group';

  useEffect(() => {
    if (currentConvo?.type === 'group' && currentConvo.group_id) {
      fetchGroupDetails(currentConvo.group_id);
    }
  }, [currentConvo?.group_id]);

  // 选择群聊时拉取成员昵称，供消息发送者名显示（不依赖右栏是否展开）
  useEffect(() => {
    if (currentConvo?.type === 'group' && currentConvo.group_id) {
      getGroupMembers(currentConvo.group_id).then((list) => {
        (list || []).forEach((m) => useChatStore.getState().fetchUserName(m.user_id));
      });
    }
  }, [currentConvo?.group_id]);

  const handleSend = useCallback(() => {
    if (!input.trim() || !currentConvoId) return;
    send('chat', {
      conversation_id: currentConvoId,
      type: 'text',
      content: input.trim(),
      client_msg_id: uuid(),
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
        client_msg_id: uuid(),
      });
    } catch { /* upload failed silently */ }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /** 上传图片文件并以图片消息发送（文件上传 / 截图共用） */
  const sendImageFile = async (file: File) => {
    if (!currentConvoId) return;
    try {
      const res = await uploadFile(file);
      send('chat', {
        conversation_id: currentConvoId,
        type: 'image',
        content: res.url,
        metadata: { file_name: file.name, file_size: file.size },
        client_msg_id: uuid(),
      });
    } catch { /* upload failed silently */ }
  };

  /** 屏幕截图：getDisplayMedia 抓取一帧，交给框选组件裁剪后发送 */
  const startScreenshot = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      showNotice('当前浏览器不支持屏幕截图');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: false,
      });
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();
      await new Promise((r) => setTimeout(r, 300)); // 等首帧稳定
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')!.drawImage(video, 0, 0);
      stream.getTracks().forEach((t) => t.stop());
      setShotSrc(canvas.toDataURL('image/png'));
    } catch {
      showNotice('截图已取消');
    }
  };

  const handleRecall = async (msgId: string) => {
    if (!currentConvoId) return;
    await recallMessage(currentConvoId, msgId);
    setContextMenu(null);
  };

  const handleContextMenu = (e: React.MouseEvent, msg: Message) => {
    if (msg.sender_id !== user?.id || msg.type === 'system') return;
    if (!isRecentMessage(msg.created_at)) return;
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
      return (
        <img
          src={mediaUrl(msg.content)}
          alt=""
          className="max-w-[280px] max-h-60 cursor-zoom-in rounded-lg"
          style={{ boxShadow: 'var(--shadow-sm)' }}
          onClick={() => setPreview({ url: mediaUrl(msg.content), fileName: msg.metadata?.file_name || '图片', type: 'image' })}
        />
      );
    }
    if (msg.type === 'file' && msg.metadata) {
      return (
        <button
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-left underline transition-colors"
          style={{ color: 'var(--accent)', border: 'none', background: 'transparent', fontFamily: 'inherit' }}
          onClick={() => setPreview({ url: mediaUrl(msg.content), fileName: msg.metadata!.file_name || '文件', type: 'unknown' })}
        >
          <PaperclipIcon size={14} />
          <span>{msg.metadata.file_name}</span>
          <span className="text-xs opacity-70">({((msg.metadata.file_size ?? 0) / 1024).toFixed(1)} KB)</span>
        </button>
      );
    }
    if (msg.type === 'system' || msg.type === 'recalled') {
      return <span className="italic" style={{ color: 'var(--text-muted)' }}>{msg.content}</span>;
    }
    return <span style={{ lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{msg.content}</span>;
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
      const showAvatar = !isSystem && !sameSender;
      const isLastOfSender = index === messages.length - 1 || !isSameSender(msg, messages[index + 1] || null);
      const senderName = getSenderName(msg);
      return { msg, isMine, isSystem, showTimeSep, sameSender, showAvatar, isLastOfSender, senderName };
    });
  }, [messages, user?.id, getSenderName]);

  const getOtherId = () => {
    if (!currentConvo || currentConvo.type === 'group') return '';
    return currentConvo.members.find((m) => m !== user?.id) || '';
  };

  const getOtherOnline = () => {
    if (!currentConvo || currentConvo.type === 'group') return false;
    const otherId = currentConvo.members.find((m) => m !== user?.id);
    return otherId ? !!onlineUsers[otherId] : false;
  };

  if (!currentConvoId) {
    return (
      <div className="chat-messages-bg flex flex-1 flex-col items-center justify-center px-6">
        <div className="ui-avatar mb-6 animate-float" style={{ width: 80, height: 80, background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
          <MessageIcon size={40} />
        </div>
        <h3 className="mb-1 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>开始新的对话</h3>
        <p className="mb-6 text-sm" style={{ color: 'var(--text-muted)' }}>从左侧选择一个会话，或发起新的聊天</p>
      </div>
    );
  }

  return (
    <>
      <div className="chat-content relative flex min-w-0 flex-1 flex-col" style={{ background: 'var(--bg-app)' }}>

        {/* 顶栏 */}
        <div
          className="flex items-center justify-between"
          style={{ height: 64, padding: '0 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}
        >
          <div className="flex items-center gap-3">
            <Avatar
              name={getConvoName}
              variant={currentConvo?.type === 'group' ? 'group' : 'user'}
              src={currentConvo?.type === 'private' ? avatarSrc(userAvatars[getOtherId()]) : undefined}
              size="md"
              online={getOtherOnline()}
              showOnlineDot={currentConvo?.type === 'private'}
            />
            <div>
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)', marginBottom: 2 }}>{getConvoName}</h2>
              {typingUsers.length > 0 ? (
                <span className="text-xs" style={{ color: 'var(--accent)', animation: 'pulse 1.5s infinite' }}>正在输入...</span>
              ) : currentConvo?.type === 'private' && getOtherOnline() ? (
                <span className="text-xs" style={{ color: 'var(--success)' }}>在线</span>
              ) : getConvoSubtitle ? (
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{getConvoSubtitle}</span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <IconButton
              label={isGroupChat ? '群聊暂不支持通话' : '语音通话'}
              disabled={isGroupChat}
              onClick={() => {
                if (!currentConvo) return;
                const otherId = currentConvo.members.find((m) => m !== user?.id);
                startCall(currentConvo.id, 'voice', getConvoName, otherId || '');
              }}
            >
              <PhoneIcon size={18} />
            </IconButton>
            <IconButton
              label={isGroupChat ? '群聊暂不支持通话' : '视频通话'}
              disabled={isGroupChat}
              onClick={() => {
                if (!currentConvo) return;
                const otherId = currentConvo.members.find((m) => m !== user?.id);
                startCall(currentConvo.id, 'video', getConvoName, otherId || '');
              }}
            >
              <VideoIcon size={18} />
            </IconButton>
            <IconButton label="投屏（暂未开放）" disabled>
              <ScreenShareIcon size={18} />
            </IconButton>
            <IconButton label="搜索消息" active={showSearch} onClick={() => setShowSearch(!showSearch)}>
              <SearchIcon size={18} />
            </IconButton>
            <div className="relative">
              <IconButton label="更多操作" active={showMore} onClick={() => setShowMore(!showMore)}>
                <MoreIcon size={18} />
              </IconButton>
              {showMore && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMore(false)} />
                  <div className="menu-box absolute right-0 top-full z-50 mt-2 w-44 animate-fade-in">
                    <button onClick={() => { openCreateGroup(); setShowMore(false); }} className="menu-item">发起群聊</button>
                    <button onClick={() => { openAddFriend(); setShowMore(false); }} className="menu-item">添加好友</button>
                    {currentConvo?.type === 'group' && (
                      <button onClick={() => { setShowGroupPanel((v) => !v); setShowMore(false); }} className="menu-item">
                        {showGroupPanel ? '收起群成员' : '展开群成员'}
                      </button>
                    )}
                    <button onClick={() => { if (currentConvoId) markAsRead(currentConvoId); setShowMore(false); }} className="menu-item">标为已读</button>
                    <div className="menu-divider" />
                    <button onClick={() => { setShowMore(false); setConfirmClear(true); }} className="menu-item is-danger">
                      清空聊天记录
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {notice && (
          <div
            className="fixed left-1/2 top-6 z-[90] -translate-x-1/2 rounded-xl px-5 py-2.5 text-sm animate-fade-in"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}
          >
            {notice}
          </div>
        )}

        {showSearch && (
          <div className="flex gap-2 px-5 py-2" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
            <Input
              className="flex-1"
              placeholder="搜索消息..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              autoFocus
            />
            <button onClick={handleSearch} className="ui-btn ui-btn-primary ui-btn-md">搜索</button>
          </div>
        )}

        {showSearch && searchResults.length > 0 && (
          <div className="max-h-40 overflow-y-auto px-5 py-2" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-tertiary)' }}>
            {searchResults.map((msg) => (
              <div key={msg.id} className="py-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--text-muted)' }}>
                  {new Date(msg.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                </span>{' '}
                <span style={{ color: 'var(--text-primary)' }}>{msg.content}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col">
        {/* 消息区域 */}
        <div className="chat-messages-bg flex-1 overflow-y-auto" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0, overflowX: 'hidden' }}>
          {decoratedMessages.map(({ msg, isMine, isSystem, showTimeSep, showAvatar, isLastOfSender, senderName }) => (
            <div key={msg.id}>
              {showTimeSep && (
                <div className="flex items-center justify-center" style={{ margin: '6px 0' }}>
                  <span className="time-divider-tag">{formatTimeSeparator(msg.created_at)}</span>
                </div>
              )}

              {isSystem && (
                <div className="flex justify-center py-1">
                  <span className="rounded text-xs px-3 py-1" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                    {msg.content}
                  </span>
                </div>
              )}

              {!isSystem && (
                <div
                  className={`flex items-start gap-2.5 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}
                  style={{ maxWidth: '70%', minWidth: 0, alignSelf: isMine ? 'flex-end' : 'flex-start', marginLeft: isMine ? 'auto' : 0 }}
                  onContextMenu={(e) => handleContextMenu(e, msg)}
                >
                  {showAvatar ? (
                    <Avatar name={senderName} src={avatarSrc(userAvatars[msg.sender_id])} size="sm" />
                  ) : (
                    <div className="w-8 flex-shrink-0" />
                  )}

                  <div className="flex flex-col gap-0.5" style={{ alignItems: isMine ? 'flex-end' : 'flex-start', minWidth: 0, maxWidth: '100%' }}>
                    {!isMine && showAvatar && currentConvo?.type === 'group' && (
                      <span className="ml-2 flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                        {senderName}
                        {(() => {
                          const role = currentConvo.group_id
                            ? groupDetails[currentConvo.group_id]?.members.find((m) => m.user_id === msg.sender_id)?.role
                            : '';
                          return role === 'owner' || role === 'admin'
                            ? <span className="group-role-badge">{role === 'owner' ? '群主' : '管理员'}</span>
                            : null;
                        })()}
                      </span>
                    )}

                    <div
                      className="animate-fade-in"
                      style={{
                        background: isMine ? 'var(--bubble-mine)' : 'var(--bubble-other)',
                        borderRadius: isMine ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                        padding: '6px 12px',
                        fontSize: 14,
                        lineHeight: 1.4,
                        color: isMine ? 'var(--bubble-mine-text)' : 'var(--bubble-other-text)',
                        wordWrap: 'break-word',
                        overflowWrap: 'break-word',
                        wordBreak: 'break-word',
                        maxWidth: '100%',
                        boxSizing: 'border-box',
                        boxShadow: isMine
                          ? 'inset 0 1px 0 rgba(255,255,255,0.10), 0 1px 2px rgba(0,0,0,0.20)'
                          : 'inset 0 1px 0 rgba(255,255,255,0.30), var(--shadow-sm)',
                        border: isMine ? 'none' : '1px solid var(--border)',
                      }}
                    >
                      {renderMessageContent(msg)}
                    </div>

                    {isLastOfSender && (
                      <span className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)', marginLeft: isMine ? 'auto' : 0 }}>
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
          ))}
          <div ref={messagesEndRef} />
        </div>

        {contextMenu && (
          <Portal>
            <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
            <div className="menu-box fixed z-50" style={{ left: contextMenu.x, top: contextMenu.y, minWidth: 120 }}>
              <button onClick={() => handleRecall(contextMenu.msgId)} className="menu-item is-danger">撤回</button>
            </div>
          </Portal>
        )}

        {/* 输入区域 */}
        <div style={{ padding: '10px 20px 12px', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          <div className="mb-2 flex gap-2">
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
            <div className="relative">
              <button onClick={() => setShowEmoji(!showEmoji)} className="toolbar-btn" title="表情">
                <SmileIcon size={18} />
              </button>
              {showEmoji && <EmojiPicker onSelect={(emoji) => setInput((prev) => prev + emoji)} onClose={() => setShowEmoji(false)} />}
            </div>
            <button onClick={() => fileInputRef.current?.click()} className="toolbar-btn" title="图片">
              <ImageIcon size={18} />
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="toolbar-btn" title="文件">
              <PaperclipIcon size={18} />
            </button>
            <button onClick={startScreenshot} className="toolbar-btn" title="截图">
              <ScreenshotIcon size={18} />
            </button>
            <button className="toolbar-btn" title="语音（暂未开放）" disabled>
              <MicIcon size={18} />
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
            <button onClick={handleSend} disabled={!input.trim()} className="modern-send-btn" title="发送">
              <SendIcon size={18} />
              <span>发送</span>
            </button>
          </div>
        </div>

        {/* AI 助手浮标「小Q」（可拖动悬浮） */}
        <button
          className={`ai-fab${fabPos ? ' is-dragged-pos' : ''}${fabDragging ? ' is-dragging' : ''}`}
          title="AI 助手 小Q（可拖动）"
          aria-label="AI 助手"
          style={fabPos ? { left: fabPos.x, top: fabPos.y } : undefined}
          onPointerDown={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            fabDragRef.current = { startX: e.clientX, startY: e.clientY, baseX: r.left, baseY: r.top, moved: false };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            const d = fabDragRef.current;
            if (!d) return;
            const dx = e.clientX - d.startX;
            const dy = e.clientY - d.startY;
            if (!d.moved && Math.abs(dx) + Math.abs(dy) < 6) return;
            if (!d.moved) { d.moved = true; setFabDragging(true); }
            setFabPos({
              x: Math.min(Math.max(d.baseX + dx, 8), window.innerWidth - 66),
              y: Math.min(Math.max(d.baseY + dy, 8), window.innerHeight - 66),
            });
          }}
          onPointerUp={() => {
            const d = fabDragRef.current;
            fabDragRef.current = null;
            setFabDragging(false);
            if (d && !d.moved) setAiOpen((v) => { if (!v) setShowGroupPanel(false); return !v; });
          }}
        >
          <Mascot size={40} floating />
        </button>
          </div>
          {aiOpen && <AiAssistant onClose={() => setAiOpen(false)} />}
          {showGroupPanel && currentConvo?.group_id && groupDetails[currentConvo.group_id] && (
            <GroupInfoPanel
              groupId={currentConvo.group_id}
              ownerId={groupDetails[currentConvo.group_id].owner_id}
              onOpenProfile={onOpenProfile}
              onLeft={() => {
                setShowGroupPanel(false);
                const s = useChatStore.getState();
                s.clearSelection();
                // 有其他会话时自动落到最近一个，避免停在已退出的群
                const next = s.conversations[0];
                if (next) s.selectConversation(next.id);
              }}
            />
          )}
        </div>
      </div>

        {/* 截图框选 */}
        {shotSrc && (
          <ScreenshotCrop
            src={shotSrc}
            onCancel={() => setShotSrc(null)}
            onSend={(file) => { setShotSrc(null); sendImageFile(file); }}
          />
        )}

        {/* 文件预览 */}
        {preview && (
          <FilePreview
            url={preview.url}
            fileName={preview.fileName}
            fileType={preview.type === 'image' ? 'image' : 'unknown'}
            onClose={() => setPreview(null)}
          />
        )}

        <Confirm
          open={confirmClear}
        title="清空聊天记录"
        description={<>将清空当前会话在本设备的聊天记录，此操作不可恢复。</>}
        confirmText="清空"
        danger
        onConfirm={() => {
          if (currentConvoId) clearMessages(currentConvoId);
          setConfirmClear(false);
          showNotice('已清空当前会话记录（本地）');
        }}
        onClose={() => setConfirmClear(false)}
      />
    </>
  );
}
