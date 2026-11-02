import { API_BASE, authHeaders, authJsonHeaders, request } from './client';

export interface AiCitation {
  index: number;
  filename: string;
  idx: number;
  text: string;
  score: number;
  /** 聊天记录归档引用（可跳转到原会话） */
  kind?: 'doc' | 'chat';
  message_id?: string;
  conversation_id?: string;
  conversation_name?: string;
  sender_name?: string;
  msg_type?: string;
  file_name?: string;
  ts?: string;
}

export interface AiDoc {
  id: number;
  filename: string;
  ext: string;
  size: number;
  status: string;
  chunk_count: number;
  created_at: string | null;
}

export interface AiToolStep {
  name: string;
  args: Record<string, unknown>;
  summary?: string;
}

export interface AiStreamHandlers {
  onCitations?: (hits: AiCitation[], cached?: boolean) => void;
  onDelta?: (text: string) => void;
  onDone?: (data: { message_id: number; conversation_id: number; cached?: boolean }) => void;
  onError?: (message: string) => void;
  onToolCall?: (step: AiToolStep) => void;
  onToolResult?: (step: AiToolStep) => void;
}

/**
 * AI 助手问答（SSE 流式）。
 * 后端 /api/ai/chat/stream 原样透传 RAG 服务的 citations / delta / done / error 事件。
 */
export async function streamAiChat(
  question: string,
  conversationId: number | null,
  handlers: AiStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${API_BASE}/ai/chat/stream`, {
    method: 'POST',
    headers: authJsonHeaders(),
    body: JSON.stringify({ question, conversation_id: conversationId }),
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error('AI 服务暂时不可用，请稍后再试');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  const dispatch = (raw: string) => {
    let event = 'message';
    const dataLines: string[] = [];
    for (const line of raw.split('\n')) {
      if (line.startsWith('event: ')) event = line.slice(7).trim();
      else if (line.startsWith('data: ')) dataLines.push(line.slice(6));
    }
    if (!dataLines.length) return;
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(dataLines.join('\n'));
    } catch {
      return;
    }
    if (event === 'citations') handlers.onCitations?.((data.hits as AiCitation[]) ?? [], data.cached === true);
    else if (event === 'delta') handlers.onDelta?.((data.text as string) ?? '');
    else if (event === 'done')
      handlers.onDone?.(data as { message_id: number; conversation_id: number });
    else if (event === 'error') handlers.onError?.((data.message as string) || 'AI 出错了');
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split('\n\n');
    buf = parts.pop() ?? '';
    parts.forEach(dispatch);
  }
  if (buf.trim()) dispatch(buf);
}

/* ===== 知识库文档管理 ===== */

async function errMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    return data.message || data.detail || fallback;
  } catch {
    return fallback;
  }
}

export async function listAiDocs(): Promise<AiDoc[]> {
  const res = await fetch(`${API_BASE}/ai/documents`, { headers: authHeaders() });
  if (!res.ok) throw new Error(await errMessage(res, '获取文档列表失败'));
  return res.json();
}

export async function uploadAiDoc(file: File): Promise<AiDoc> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${API_BASE}/ai/documents/upload`, {
    method: 'POST',
    headers: authHeaders(),
    body: fd,
  });
  if (!res.ok) throw new Error(await errMessage(res, '上传失败'));
  return res.json();
}

export async function deleteAiDoc(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/ai/documents/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await errMessage(res, '删除失败'));
}

export async function rebuildAiIndex(): Promise<void> {
  const res = await fetch(`${API_BASE}/ai/index/rebuild`, {
    method: 'POST',
    headers: authJsonHeaders(),
  });
  if (!res.ok) throw new Error(await errMessage(res, '重建索引失败'));
}

/** 点赞/点踩 AI 回答（点赞使其进入热缓存，同问秒回） */
export function rateAiAnswer(messageId: number, rating: 'up' | 'down'): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/ai/rate/${messageId}`, {
    method: 'POST',
    body: JSON.stringify({ rating }),
  });
}
