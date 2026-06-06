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
