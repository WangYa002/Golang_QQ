import { create } from 'zustand';
import type { Conversation, Message, Group } from '../types';
import * as convoApi from '../api/conversations';
import * as userApi from '../api/users';
import * as groupApi from '../api/groups';

interface ChatState {
  conversations: Conversation[];
  currentConvoId: string | null;
  messages: Record<string, Message[]>;
  typingUsers: Record<string, string[]>;
  onlineUsers: Record<string, boolean>;
  userNames: Record<string, string>;
  groupDetails: Record<string, Group>;
  unreadCount: Record<string, number>;

  fetchConversations: () => Promise<void>;
  selectConversation: (id: string) => Promise<void>;
  addMessage: (msg: Message) => void;
  setTyping: (convoId: string, userId: string) => void;
  setUserOnline: (userId: string) => void;
  setUserOffline: (userId: string) => void;
  fetchUserName: (userId: string) => Promise<void>;
  createGroup: (name: string, memberIds: string[]) => Promise<void>;
  fetchGroupDetails: (groupId: string) => Promise<void>;
  addGroupMember: (groupId: string, userId: string) => Promise<void>;
  leaveGroup: (groupId: string, userId: string) => Promise<void>;
  markAsRead: (convoId: string) => void;
  getTotalUnread: () => number;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  currentConvoId: null,
  messages: {},
  typingUsers: {},
  onlineUsers: {},
  userNames: {},
  groupDetails: {},
  unreadCount: {},

  fetchConversations: async () => {
    const convos = await convoApi.getConversations();
    // 按 updated_at 降序排列
    const sorted = [...convos].sort((a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
    set({ conversations: sorted });
  },

  selectConversation: async (id) => {
    set({ currentConvoId: id });
    // 清除未读
    set((s) => {
      const { [id]: _, ...rest } = s.unreadCount;
      return { unreadCount: rest };
    });
    if (!get().messages[id]) {
      const msgs = await convoApi.getMessages(id);
      set((s) => ({ messages: { ...s.messages, [id]: msgs.reverse() } }));
    }
  },

  addMessage: (msg) => {
    const currentConvoId = get().currentConvoId;
    set((s) => {
      const convoMsgs = s.messages[msg.conversation_id] || [];
      return {
        messages: { ...s.messages, [msg.conversation_id]: [...convoMsgs, msg] },
      };
    });
    // 更新会话列表（移到顶部）
    set((s) => ({
      conversations: [
        ...s.conversations.map((c) =>
          c.id === msg.conversation_id
            ? { ...c, last_message: { content: msg.content, sender_id: msg.sender_id, type: msg.type, created_at: msg.created_at }, updated_at: msg.created_at }
            : c
        ).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
      ],
    }));
    // 非当前会话增加未读
    if (msg.conversation_id !== currentConvoId) {
      set((s) => ({
        unreadCount: {
          ...s.unreadCount,
          [msg.conversation_id]: (s.unreadCount[msg.conversation_id] || 0) + 1,
        },
      }));
    }
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

  createGroup: async (name, memberIds) => {
    const res = await groupApi.createGroup(name, '', memberIds);
    await get().fetchConversations();
    if (res.conversation?.id) {
      get().selectConversation(res.conversation.id);
    }
  },

  fetchGroupDetails: async (groupId) => {
    if (get().groupDetails[groupId]) return;
    try {
      const group = await groupApi.getGroup(groupId);
      set((s) => ({ groupDetails: { ...s.groupDetails, [groupId]: group } }));
    } catch {
      // ignore
    }
  },

  addGroupMember: async (groupId, userId) => {
    await groupApi.addGroupMember(groupId, userId);
    // 刷新群详情
    set((s) => {
      const { [groupId]: _, ...rest } = s.groupDetails;
      return { groupDetails: rest };
    });
    get().fetchGroupDetails(groupId);
  },

  leaveGroup: async (groupId, userId) => {
    await groupApi.removeGroupMember(groupId, userId);
    await get().fetchConversations();
  },

  markAsRead: (convoId) => {
    set((s) => {
      const { [convoId]: _, ...rest } = s.unreadCount;
      return { unreadCount: rest };
    });
  },

  getTotalUnread: () => {
    return Object.values(get().unreadCount).reduce((sum, n) => sum + n, 0);
  },
}));
