import { request } from './client';
import type { User } from '../types';

export function getMe() {
  return request<User>('/users/me');
}

export function getUser(id: string) {
  return request<User>(`/users/${id}`);
}

export function updateMe(data: { nickname?: string; avatar?: string; bio?: string; email?: string }) {
  return request<User>('/users/me', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function searchUsers(q: string) {
  return request<User[]>(`/users/search?q=${encodeURIComponent(q)}`);
}
