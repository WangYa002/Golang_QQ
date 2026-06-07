import { request } from './client';
import type { Group, GroupMemberWithUser } from '../types';

export function createGroup(name: string, avatar: string, memberIds: string[]) {
  return request<{ group: Group; conversation: unknown }>('/groups', {
    method: 'POST',
    body: JSON.stringify({ name, avatar, member_ids: memberIds }),
  });
}

export function getGroup(id: string) {
  return request<Group>(`/groups/${id}`);
}

export function updateGroup(id: string, data: { name?: string; announcement?: string }) {
  return request(`/groups/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function getGroupMembers(id: string) {
  return request<GroupMemberWithUser[]>(`/groups/${id}/members`);
}

export function addGroupMember(groupId: string, userId: string) {
  return request('/groups/' + groupId + '/members', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  });
}

export function removeGroupMember(groupId: string, userId: string) {
  return request(`/groups/${groupId}/members/${userId}`, { method: 'DELETE' });
}
