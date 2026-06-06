import { create } from 'zustand';
import type { Conversation, Message } from '../types';
import * as convoApi from '../api/conversations';

interface ChatState {
  conversations: Conversation[];
  currentConvoId: string | null;
  messages: Record<string, Message[]>;
  typingUsers: Record<string, string[]>;
  onlineUsers: Record<string, boolean>;

  fetchConversations: () => Promise<void>;
  selectConversation: (id: string) => Promise<void>;
  addMessage: (msg: Message) => void;
  setTyping: (convoId: string, userId: string) => void;
  setUserOnline: (userId: string) => void;
  setUserOffline: (userId: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  currentConvoId: null,
  messages: {},
  typingUsers: {},
  onlineUsers: {},

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
}));
