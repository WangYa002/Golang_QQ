import { request } from './client';
import type { AdminStats, AdminList, User, Conversation, AdminMessageRow, AdminGroupRow, AdminFriendRow, AdminRequestRow } from '../types';

export function getStats() {
  return request<AdminStats>('/admin/stats');
}

export function listUsers(page: number, pageSize: number, q = '') {
  const query = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  if (q) query.set('q', q);
  return request<AdminList<User>>(`/admin/users?${query}`);
}

export function listConversations(page: number, pageSize: number) {
  return request<AdminList<Conversation>>(`/admin/conversations?page=${page}&page_size=${pageSize}`);
}

export function listMessages(page: number, pageSize: number, q = '') {
  const query = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  if (q) query.set('q', q);
  return request<AdminList<AdminMessageRow>>(`/admin/messages?${query}`);
}

export function listGroups(page: number, pageSize: number) {
  return request<AdminList<AdminGroupRow>>(`/admin/groups?page=${page}&page_size=${pageSize}`);
}

export function listFriends(page: number, pageSize: number) {
  return request<AdminList<AdminFriendRow>>(`/admin/friends?page=${page}&page_size=${pageSize}`);
}

export function listFriendRequests(page: number, pageSize: number) {
  return request<AdminList<AdminRequestRow>>(`/admin/friend_requests?page=${page}&page_size=${pageSize}`);
}
