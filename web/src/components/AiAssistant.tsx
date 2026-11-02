import { useEffect, useRef, useState } from 'react';
import { streamAiChat, listAiDocs, uploadAiDoc, deleteAiDoc, rebuildAiIndex, rateAiAnswer, type AiCitation, type AiDoc, type AiToolStep } from '../api/ai';
import { API_BASE, authJsonHeaders } from '../api/client';
import { useChatStore } from '../store/chat';
import { Mascot } from './Mascot';
import { BookIcon, CloseIcon, PlusIcon, SendIcon, TrashIcon } from './icons';
import { useMascotStore, MASCOT_SKINS, skinFromColor } from '../store/mascot';
import { IconButton } from './ui/IconButton';
import { Modal } from './ui/Modal';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
  citations?: AiCitation[];
  streaming?: boolean;
  toolSteps?: AiToolStep[];
  ragMessageId?: number;
  rating?: 'up' | 'down';
}

const TOOL_LABELS: Record<string, string> = {
  search_chat_archive: '搜索聊天记录',
  search_knowledge_base: '搜索知识库',
  get_time: '查看时间',
  get_weather: '查询天气',
};

/** MCP 外部工具标签：mcp__fx__exchange_rate → MCP·fx·exchange_rate */
function toolLabel(name: string): string {
  if (name.startsWith('mcp__')) return '🔌 ' + name.slice(5).replace(/__/g, '·');
  return TOOL_LABELS[name] ?? name;
}

const QUICK_PROMPTS = ['谁给我发过文件或简历？', '总结一下知识库里的内容', '最近谁给我发过消息？'];

/**
 * AI 助手面板（右列）：卡通形象「小Q」+ 流式问答 + 引用溯源。
 * 数据来自 /api/ai/chat/stream（RAG-Assistant 的 SSE 代理）。
 */
export default function AiAssistant({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  // 知识库管理
  const [showKb, setShowKb] = useState(false);
  const [showSkin, setShowSkin] = useState(false);
  const [docs, setDocs] = useState<AiDoc[]>([]);
  const setSkin = useMascotStore((s) => s.setSkin);
  const [kbBusy, setKbBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const patchMsg = (idx: number, patch: Partial<Msg>) =>
    setMessages((m) => {
      const next = [...m];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });

  const loadDocs = async () => {
    try {
      setDocs(await listAiDocs());
    } catch {
      /* 面板内静默 */
    }
  };

  useEffect(() => {
    if (!showKb) return;
    let cancelled = false;
    listAiDocs()
      .then((items) => { if (!cancelled) setDocs(items); })
      .catch(() => { /* 面板内静默 */ });
    return () => { cancelled = true; };
  }, [showKb]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setKbBusy(true);
    try {
      await uploadAiDoc(file);
      await loadDocs();
    } catch (err) {
      alert(err instanceof Error ? err.message : '上传失败');
    } finally {
      setKbBusy(false);
    }
  };

  const handleDeleteDoc = async (id: number) => {
    setKbBusy(true);
    try {
      await deleteAiDoc(id);
      setDocs((d) => d.filter((x) => x.id !== id));
    } finally {
      setKbBusy(false);
    }
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = async (question: string) => {
    const q = question.trim();
    if (!q || streaming) return;
    setInput('');
    setMessages((m) => [
      ...m,
      { role: 'user', content: q },
      { role: 'assistant', content: '', citations: undefined, streaming: true },
    ]);
    setStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;

    const patchLast = (patch: Partial<Msg>) =>
      setMessages((m) => {
        const next = [...m];
        next[next.length - 1] = { ...next[next.length - 1], ...patch };
        return next;
      });

    const step = (st: AiToolStep) =>
      setMessages((m) => {
        const next = [...m];
        const last = next[next.length - 1];
        next[next.length - 1] = { ...last, toolSteps: [...(last.toolSteps ?? []), st] };
        return next;
      });
    try {
      await streamAiChat(
        q,
        conversationId,
        {
          onCitations: (hits) => patchLast({ citations: hits }),
          onToolCall: (st) => step(st),
          onToolResult: (st) => step(st),
          onDelta: (text) =>
            setMessages((m) => {
              const next = [...m];
              const last = next[next.length - 1];
              next[next.length - 1] = { ...last, content: last.content + text };
              return next;
            }),
          onDone: (data) => {
            setConversationId(data.conversation_id ?? null);
            patchLast({ streaming: false, ragMessageId: data.message_id });
          },
          onError: (message) => patchLast({ content: `出错了：${message}`, streaming: false }),
        },
        controller.signal,
      );
      patchLast({ streaming: false });
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        patchLast({ content: `出错了：${(err as Error).message}`, streaming: false });
      }
      setStreaming(false);
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  return (
    <div className="ai-panel" role="dialog" aria-label="AI 助手">
      {/* 头部 */}
      <div className="ai-panel-head">
        <div className="ai-panel-title">
          <Mascot size={30} />
          <div>
            <div className="ai-panel-name">小Q · AI 助手</div>
            <div className="ai-panel-sub">知识库问答 · 资讯 · 闲聊</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <IconButton label="小Q 换肤" size="sm" onClick={() => setShowSkin((v) => !v)}>
            <span className="skin-palette-icon" aria-hidden="true">🎨</span>
          </IconButton>
          <IconButton label="生成小Q 早报" size="sm" onClick={async () => {
            try {
              const res = await fetch(`${API_BASE}/ai/push/trigger`, { method: 'POST', headers: authJsonHeaders() });
              if (!res.ok) throw new Error();
            } catch { /* 早报生成失败静默 */ }
          }}>
            <span className="skin-palette-icon" aria-hidden="true">📰</span>
          </IconButton>
          <IconButton label="知识库管理" size="sm" onClick={() => setShowKb(true)}>
            <BookIcon size={15} />
          </IconButton>
          <IconButton label="关闭" size="sm" onClick={onClose}>
            <CloseIcon size={14} />
          </IconButton>
        </div>
      </div>

      {/* 换肤面板 */}
      {showSkin && (
        <div className="ai-skin-bar">
          {MASCOT_SKINS.map((s) => (
            <button
              key={s.id}
              className="ai-skin-item"
              title={s.name}
              onClick={() => setSkin(s)}
            >
              <Mascot size={34} skin={s} />
              <span>{s.name}</span>
            </button>
          ))}
          <label className="ai-skin-item ai-skin-custom" title="自定义颜色">
            <input
              type="color"
              className="ai-skin-color"
              onChange={(e) => setSkin(skinFromColor(e.target.value))}
            />
            <span>自定义</span>
          </label>
        </div>
      )}

      {/* 消息区 */}
      <div className="ai-msgs">
        {messages.length === 0 && (
          <div className="ai-empty">
            <Mascot size={72} floating />
            <p className="ai-empty-title">嗨，我是小Q！</p>
            <p className="ai-empty-sub">可以问我知识库内容、天气资讯，或者随便聊聊～</p>
            <div className="ai-quick">
              {QUICK_PROMPTS.map((q) => (
                <button key={q} className="ai-quick-chip" onClick={() => send(q)}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="ai-row ai-row-user">
              <div className="ai-bubble-user">{m.content}</div>
            </div>
          ) : (
            <div key={i} className="ai-row">
              <div className="ai-msg-ai">
                <Mascot size={28} />
                <div className="ai-msg-col">
                  {m.toolSteps && m.toolSteps.length > 0 && (
                    <div className="ai-steps">
                      {m.toolSteps.map((st, i) => (
                        <span key={i} className="ai-step">
                          🔧 {toolLabel(st.name)}
                          {st.summary !== undefined ? ' ✓' : '…'}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="ai-bubble-ai">
                  {m.content || (m.streaming ? <span className="ai-dot-pulse">思考中…</span> : '')}
                  {m.streaming && m.content && <span className="ai-cursor" />}
                  {m.citations && m.citations.length > 0 && (
                    <div className="ai-cites">
                      {m.citations.map((c) =>
                        c.kind === 'chat' ? (
                          <button
                            key={c.index}
                            className="ai-cite ai-cite-chat"
                            title={c.text}
                            onClick={() => {
                              if (c.conversation_id) {
                                useChatStore.getState().selectConversation(c.conversation_id);
                              }
                            }}
                          >
                            [{c.index}] {c.sender_name || '未知'} · {(c.ts || '').slice(5, 10)}
                            {c.file_name ? ` · ${c.file_name}` : ''}
                          </button>
                        ) : (
                          <span key={c.index} className="ai-cite" title={c.text}>
                            [{c.index}] {c.filename}
                          </span>
                        ),
                      )}
                    </div>
                  )}
                </div>
                  {!m.streaming && m.ragMessageId && (
                    <div className="ai-rate">
                      <button
                        className={`ai-rate-btn ${m.rating === 'up' ? 'active' : ''}`}
                        title="有帮助（进入热缓存，同问秒回）"
                        onClick={() => rateAiAnswer(m.ragMessageId!, 'up').then(() => patchMsg(i, { rating: 'up' })).catch(() => {})}
                      >👍</button>
                      <button
                        className={`ai-rate-btn ${m.rating === 'down' ? 'active' : ''}`}
                        title="没帮助"
                        onClick={() => rateAiAnswer(m.ragMessageId!, 'down').then(() => patchMsg(i, { rating: 'down' })).catch(() => {})}
                      >👎</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ),
        )}
        <div ref={endRef} />
      </div>

      {/* 输入区 */}
      <div className="ai-input-row">
        <input
          className="ai-input"
          placeholder="问问小Q…"
          value={input}
          disabled={streaming}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send(input)}
        />
        <button
          className="ai-send"
          aria-label="发送"
          disabled={streaming || !input.trim()}
          onClick={() => send(input)}
        >
          <SendIcon size={16} />
        </button>
      </div>

      {/* 知识库管理 */}
      <Modal open={showKb} title="知识库管理" onClose={() => setShowKb(false)} width={420}>
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.md,.pdf,.docx"
          className="hidden"
          onChange={handleUpload}
        />
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            共 {docs.length} 个文档 · 支持 txt / md / pdf / docx
          </span>
          <button
            className="ai-kb-upload"
            disabled={kbBusy}
            onClick={() => fileRef.current?.click()}
          >
            <PlusIcon size={14} />
            {kbBusy ? '处理中…' : '上传文档'}
          </button>
        </div>
        <div className="ai-kb-list">
          {docs.map((d) => (
            <div key={d.id} className="ai-kb-row">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm" style={{ color: 'var(--text-primary)' }}>{d.filename}</div>
                <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {d.status} · {d.chunk_count} 片段 · {Math.max(1, Math.round(d.size / 1024))} KB
                </div>
              </div>
              <IconButton label="删除文档" size="sm" danger disabled={kbBusy} onClick={() => handleDeleteDoc(d.id)}>
                <TrashIcon size={13} />
              </IconButton>
            </div>
          ))}
          {docs.length === 0 && (
            <p className="py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              还没有文档，上传后小Q 就能回答知识库问题
            </p>
          )}
        </div>
        <div className="mt-3 text-right">
          <button
            className="text-xs"
            style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: kbBusy ? 'default' : 'pointer' }}
            disabled={kbBusy}
            onClick={async () => {
              setKbBusy(true);
              try { await rebuildAiIndex(); } finally { setKbBusy(false); }
            }}
          >
            重建向量索引
          </button>
        </div>
      </Modal>
    </div>
  );
}
