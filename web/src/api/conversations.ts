import { request } from './client';
import type { Conversation, Message } from '../types';

export function getConversations() {
  return request<Conversation[]>('/conversations');
}

export function createConversation(userId: string) {
  return request<Conversation>('/conversations', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  });
}

export function getMessages(conversationId: string, skip = 0) {
  return request<Message[]>(`/conversations/${conversationId}/messages?skip=${skip}`);
}

export function recallMessage(conversationId: string, messageId: string) {
  return request(`/conversations/${conversationId}/messages/${messageId}`, {
    method: 'DELETE',
  });
}

export function searchMessages(conversationId: string, query: string) {
  return request<Message[]>(`/conversations/${conversationId}/messages/search?q=${encodeURIComponent(query)}`);
}

/** HTTP 发送消息（WS 断线时的兜底通道；client_msg_id 保证幂等） */
export function sendMessageREST(
  convoId: string,
  payload: { type: string; content: string; client_msg_id: string; metadata?: Message['metadata'] },
): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/conversations/${convoId}/messages`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
