import { useState, useRef, useEffect } from 'react';
import { useChatStore } from '../store/chat';
import { useAuthStore } from '../store/auth';
import { useWebSocket } from '../hooks/useWebSocket';
import { uploadFile } from '../api/client';
import type { Message } from '../types';

// 判断两条消息是否需要时间分隔线（间隔超过5分钟）
function shouldShowTimeSeparator(prev: Message | null, curr: Message): boolean {
  if (!prev) return true;
  const diff = new Date(curr.created_at).getTime() - new Date(prev.created_at).getTime();
  return diff > 5 * 60 * 1000;
}

// 判断两条消息是否来自同一发送者（连续消息合并）
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

export default function ChatArea() {
  const currentConvoId = useChatStore((s) => s.currentConvoId);
  const messageMap = useChatStore((s) => s.messages);
  const messages = currentConvoId ? (messageMap[currentConvoId] || []) : [];
  const typingUserMap = useChatStore((s) => s.typingUsers);
  const typingUsers = currentConvoId ? (typingUserMap[currentConvoId] || []) : [];
  const conversations = useChatStore((s) => s.conversations);
  const user = useAuthStore((s) => s.user);
  const userNames = useChatStore((s) => s.userNames);
  const groupDetails = useChatStore((s) => s.groupDetails);
  const fetchGroupDetails = useChatStore((s) => s.fetchGroupDetails);
  const { send } = useWebSocket();

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const currentConvo = conversations.find((c) => c.id === currentConvoId);

  // 加载群聊详情
  useEffect(() => {
    if (currentConvo?.type === 'group' && currentConvo.group_id) {
      fetchGroupDetails(currentConvo.group_id);
    }
  }, [currentConvo?.group_id]);

  const handleSend = () => {
    if (!input.trim() || !currentConvoId) return;
    send('chat', {
      conversation_id: currentConvoId,
      type: 'text',
      content: input.trim(),
    });
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (input.trim()) {
      send('typing', { conversation_id: currentConvoId });
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

  const renderMessageContent = (msg: Message) => {
    if (msg.type === 'image') {
      return <img src={msg.content} alt="" className="max-w-[280px] max-h-60 rounded-xl cursor-pointer" style={{ boxShadow: 'var(--shadow-sm)' }} />;
    }
    if (msg.type === 'file' && msg.metadata) {
      return (
        <a href={msg.content} download={msg.metadata.file_name} className="inline-flex items-center gap-2 underline"
          style={{ color: 'var(--accent-light)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
          {msg.metadata.file_name} ({(msg.metadata.file_size / 1024).toFixed(1)} KB)
        </a>
      );
    }
    if (msg.type === 'system') {
      return <span className="italic" style={{ color: 'var(--text-muted)' }}>{msg.content}</span>;
    }
    return <span style={{ lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{msg.content}</span>;
  };

  const getConvoName = () => {
    if (!currentConvo) return '';
    if (currentConvo.type === 'group') {
      if (currentConvo.group_id && groupDetails[currentConvo.group_id]) {
        return groupDetails[currentConvo.group_id].name;
      }
      return '群聊';
    }
    const otherId = currentConvo.members.find((m) => m !== user?.id);
    return otherId ? (userNames[otherId] || '私聊') : '私聊';
  };

  const getConvoSubtitle = () => {
    if (!currentConvo) return '';
    if (currentConvo.type === 'group' && currentConvo.group_id) {
      const group = groupDetails[currentConvo.group_id];
      if (group) return `${group.members.length} 位成员`;
    }
    return '';
  };

  const getOtherOnline = () => {
    if (!currentConvo || currentConvo.type === 'group') return false;
    const otherId = currentConvo.members.find((m) => m !== user?.id);
    return otherId ? !!useChatStore.getState().onlineUsers[otherId] : false;
  };

  // 空状态
  if (!currentConvoId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="w-24 h-24 rounded-3xl flex items-center justify-center mb-6"
          style={{ background: 'var(--bg-tertiary)' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <p className="text-lg font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
          选择一个会话
        </p>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          开始你的对话
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col" style={{ background: 'var(--bg-primary)' }}>

      {/* 顶栏 */}
      <div className="px-6 py-3.5 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--border)', background: 'rgba(22, 22, 37, 0.5)', backdropFilter: 'blur(10px)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold"
            style={{
              background: currentConvo?.type === 'group'
                ? 'linear-gradient(135deg, #e17055, #d63031)'
                : 'linear-gradient(135deg, var(--accent), var(--accent-dark))',
              color: '#fff',
            }}>
            {currentConvo?.type === 'group' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            ) : getConvoName()[0]?.toUpperCase()}
          </div>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {getConvoName()}
            </h2>
            {typingUsers.length > 0 ? (
              <span className="text-xs" style={{ color: 'var(--accent-light)', animation: 'pulse 1.5s infinite' }}>
                正在输入...
              </span>
            ) : currentConvo?.type === 'private' && getOtherOnline() ? (
              <span className="text-xs flex items-center gap-1" style={{ color: 'var(--success)' }}>
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: 'var(--success)' }} />
                在线
              </span>
            ) : getConvoSubtitle() ? (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {getConvoSubtitle()}
              </span>
            ) : null}
          </div>
        </div>

        {/* 右侧操作 */}
        <div className="flex items-center gap-1">
          <button className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            title="语音通话">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </button>
          <button className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            title="视频通话">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          </button>
        </div>
      </div>

      {/* 消息区域 */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {messages.map((msg, index) => {
          const isMine = msg.sender_id === user?.id;
          const isSystem = msg.type === 'system';
          const prevMsg = index > 0 ? messages[index - 1] : null;
          const showTimeSep = shouldShowTimeSeparator(prevMsg, msg);
          const sameSender = isSameSender(prevMsg, msg);
          const showAvatar = !isMine && !isSystem && !sameSender;

          return (
            <div key={msg.id}>
              {/* 时间分隔线 */}
              {showTimeSep && (
                <div className="flex items-center justify-center py-3">
                  <span className="text-[11px] px-3 py-1 rounded-full"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                    {formatTimeSeparator(msg.created_at)}
                  </span>
                </div>
              )}

              {/* 系统消息 */}
              {isSystem && (
                <div className="flex justify-center py-1">
                  <span className="text-xs px-3 py-1 rounded-full"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                    {msg.content}
                  </span>
                </div>
              )}

              {/* 普通消息 */}
              {!isSystem && (
                <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} items-end gap-2 ${sameSender ? 'mt-0.5' : 'mt-2'}`}>
                  {/* 对方头像 */}
                  {showAvatar ? (
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))', color: '#fff' }}>
                      {getConvoName()[0]?.toUpperCase()}
                    </div>
                  ) : !isMine ? (
                    <div className="w-8 flex-shrink-0" />
                  ) : null}

                  {/* 消息气泡 */}
                  <div className="max-w-[65%]">
                    <div
                      className={`px-4 py-2.5 text-sm ${sameSender && !isMine ? '' : ''}`}
                      style={{
                        background: isMine ? 'var(--bubble-mine)' : 'var(--bubble-other)',
                        color: isMine ? '#fff' : 'var(--text-primary)',
                        borderRadius: isMine
                          ? (sameSender ? '18px 4px 4px 18px' : '18px 18px 4px 18px')
                          : (sameSender ? '4px 18px 18px 4px' : '18px 18px 18px 4px'),
                        boxShadow: isMine ? '0 2px 12px rgba(108, 92, 231, 0.2)' : 'var(--shadow-sm)',
                      }}
                    >
                      {renderMessageContent(msg)}
                    </div>
                    {/* 最后一条消息显示时间 */}
                    {(index === messages.length - 1 || !isSameSender(msg, messages[index + 1] || null)) && (
                      <div className={`text-[10px] mt-1 ${isMine ? 'text-right' : 'text-left'}`}
                        style={{ color: 'var(--text-muted)' }}>
                        {new Date(msg.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <div className="px-6 py-4" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="flex items-end gap-3">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer flex-shrink-0"
            style={{ color: 'var(--text-muted)', background: 'var(--bg-tertiary)' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
            title="上传文件"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>

          <div className="flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息..."
              className="w-full px-4 py-2.5 rounded-xl outline-none text-sm"
              style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
            />
          </div>

          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer flex-shrink-0"
            style={{
              background: input.trim() ? 'linear-gradient(135deg, var(--accent), var(--accent-dark))' : 'var(--bg-tertiary)',
              color: input.trim() ? '#fff' : 'var(--text-muted)',
              boxShadow: input.trim() ? '0 2px 10px rgba(108, 92, 231, 0.3)' : 'none',
            }}
            title="发送"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
