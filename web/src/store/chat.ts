import { create } from 'zustand';
import type { Conversation, Message } from '../types';
import * as convoApi from '../api/conversations';
import * as userApi from '../api/users';

interface ChatState {
  conversations: Conversation[];
  currentConvoId: string | null;
  messages: Record<string, Message[]>;
  typingUsers: Record<string, string[]>;
  onlineUsers: Record<string, boolean>;
  userNames: Record<string, string>;

  fetchConversations: () => Promise<void>;
  selectConversation: (id: string) => Promise<void>;
  addMessage: (msg: Message) => void;
  setTyping: (convoId: string, userId: string) => void;
  setUserOnline: (userId: string) => void;
  setUserOffline: (userId: string) => void;
  fetchUserName: (userId: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  currentConvoId: null,
  messages: {},
  typingUsers: {},
  onlineUsers: {},
  userNames: {},

  fetchConversations: async () => {
    const convos = await convoApi.getConversations();
    set({ conversations: convos });
  },

  selectConversation: async (id) => {
    set({ currentConvoId: id });
    if (!get().messages[id]) {
      const msgs = await convoApi.getMessages(id);
      set((s) => ({ messages: { ...s.messages, [id]: msgs.reverse() } }));
    }
  },

  addMessage: (msg) => {
    set((s) => {
      const convoMsgs = s.messages[msg.conversation_id] || [];
      return {
        messages: { ...s.messages, [msg.conversation_id]: [...convoMsgs, msg] },
      };
    });
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === msg.conversation_id
          ? { ...c, last_message: { content: msg.content, sender_id: msg.sender_id, type: msg.type, created_at: msg.created_at }, updated_at: msg.created_at }
          : c
      ),
    }));
  },

  setTyping: (convoId, userId) => {
    set((s) => {
      const users = s.typingUsers[convoId] || [];
      if (users.includes(userId)) return s;
      return { typingUsers: { ...s.typingUsers, [convoId]: [...users, userId] } };
    });
    setTimeout(() => {
      set((s) => ({
        typingUsers: {
          ...s.typingUsers,
          [convoId]: (s.typingUsers[convoId] || []).filter((u) => u !== userId),
        },
      }));
    }, 3000);
  },

  setUserOnline: (userId) => {
    set((s) => ({
      onlineUsers: { ...s.onlineUsers, [userId]: true },
    }));
  },

  setUserOffline: (userId) => {
    set((s) => {
      const { [userId]: _, ...rest } = s.onlineUsers;
      return { onlineUsers: rest };
    });
  },

  fetchUserName: async (userId) => {
    if (get().userNames[userId]) return;
    try {
      const users = await userApi.searchUsers(userId);
      const found = users.find((u) => u.id === userId);
      if (found) {
        set((s) => ({
          userNames: { ...s.userNames, [userId]: found.nickname || found.username },
        }));
      }
    } catch {
      // ignore
    }
  },
}));
