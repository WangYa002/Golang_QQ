import { useState, useRef, useEffect } from 'react';
import { useChatStore } from '../store/chat';
import { useAuthStore } from '../store/auth';
import { useWebSocket } from '../hooks/useWebSocket';
import { uploadFile } from '../api/client';
import type { Message } from '../types';

export default function ChatArea() {
  const currentConvoId = useChatStore((s) => s.currentConvoId);
  const messages = useChatStore((s) => s.currentConvoId ? (s.messages[s.currentConvoId] || []) : []);
  const typingUsers = useChatStore((s) => s.currentConvoId ? (s.typingUsers[s.currentConvoId] || []) : []);
  const conversations = useChatStore((s) => s.conversations);
  const user = useAuthStore((s) => s.user);
  const { send } = useWebSocket();

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const currentConvo = conversations.find((c) => c.id === currentConvoId);

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
      return <img src={msg.content} alt="" className="max-w-xs max-h-60 rounded-lg" />;
    }
    if (msg.type === 'file' && msg.metadata) {
      return (
        <a href={msg.content} download={msg.metadata.file_name} className="underline" style={{ color: '#81c784' }}>
          📎 {msg.metadata.file_name} ({(msg.metadata.file_size / 1024).toFixed(1)} KB)
        </a>
      );
    }
    if (msg.type === 'system') {
      return <span className="italic" style={{ color: 'var(--text-secondary)' }}>{msg.content}</span>;
    }
    return <span>{msg.content}</span>;
  };

  if (!currentConvoId) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <p style={{ color: 'var(--text-secondary)' }}>选择一个会话开始聊天</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center" style={{ borderBottom: '1px solid var(--border)' }}>
        <h2 className="text-base font-medium" style={{ color: 'var(--text-primary)' }}>
          {currentConvo?.type === 'group' ? '群聊' : '私聊'}
        </h2>
        {typingUsers.length > 0 && (
          <span className="ml-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
            对方正在输入...
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => {
          const isMine = msg.sender_id === user?.id;
          return (
            <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div
                className="max-w-xs lg:max-w-md px-3 py-2 rounded-xl text-sm"
                style={{
                  background: isMine ? 'var(--accent)' : 'var(--bg-tertiary)',
                  color: isMine ? '#c0e0c0' : 'var(--text-primary)',
                }}
              >
                {renderMessageContent(msg)}
                <div className="text-xs mt-1" style={{ color: isMine ? '#8ab88a' : 'var(--text-secondary)' }}>
                  {new Date(msg.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 flex gap-2 items-end" style={{ borderTop: '1px solid var(--border)' }}>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileUpload}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-2 rounded-lg cursor-pointer"
          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
        >
          📎
        </button>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息..."
          className="flex-1 px-3 py-2 rounded-lg outline-none text-sm"
          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
        />
        <button
          onClick={handleSend}
          className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
          style={{ background: 'var(--accent)', color: '#c0e0c0' }}
        >
          发送
        </button>
      </div>
    </div>
  );
}
