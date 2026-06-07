import { request } from './client';
import type { Friend, FriendRequest } from '../types';

export function sendFriendRequest(toUserId: string, message: string) {
  return request<{ id: string }>('/friends/request', {
    method: 'POST',
    body: JSON.stringify({ to_user_id: toUserId, message }),
  });
}

export function getFriendRequests() {
  return request<FriendRequest[]>('/friends/requests');
}

export function handleFriendRequest(id: string, action: 'accept' | 'reject') {
  return request(`/friends/requests/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ action }),
  });
}

export function getFriends() {
  return request<Friend[]>('/friends');
}

export function deleteFriend(id: string) {
  return request(`/friends/${id}`, { method: 'DELETE' });
}

export function updateFriendRemark(id: string, remark: string) {
  return request(`/friends/${id}/remark`, {
    method: 'PUT',
    body: JSON.stringify({ remark }),
  });
}
