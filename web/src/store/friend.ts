import { create } from 'zustand';
import type { Friend, FriendRequest } from '../types';
import * as friendApi from '../api/friends';

interface FriendState {
  friends: Friend[];
  requests: FriendRequest[];
  loading: boolean;
  fetchFriends: () => Promise<void>;
  fetchRequests: () => Promise<void>;
  sendRequest: (toUserId: string, message: string) => Promise<void>;
  acceptRequest: (id: string) => Promise<void>;
  rejectRequest: (id: string) => Promise<void>;
  removeFriend: (id: string) => Promise<void>;
  getPendingCount: () => number;
}

export const useFriendStore = create<FriendState>((set, get) => ({
  friends: [],
  requests: [],
  loading: false,

  fetchFriends: async () => {
    const friends = await friendApi.getFriends();
    set({ friends: friends || [] });
  },

  fetchRequests: async () => {
    const requests = await friendApi.getFriendRequests();
    set({ requests: requests || [] });
  },

  sendRequest: async (toUserId, message) => {
    await friendApi.sendFriendRequest(toUserId, message);
  },

  acceptRequest: async (id) => {
    await friendApi.handleFriendRequest(id, 'accept');
    set((s) => ({ requests: s.requests.filter((r) => r.id !== id) }));
    await get().fetchFriends();
  },

  rejectRequest: async (id) => {
    await friendApi.handleFriendRequest(id, 'reject');
    set((s) => ({ requests: s.requests.filter((r) => r.id !== id) }));
  },

  removeFriend: async (id) => {
    await friendApi.deleteFriend(id);
    set((s) => ({ friends: s.friends.filter((f) => f.id !== id) }));
  },

  getPendingCount: () => get().requests.length,
}));
