import { create, type StoreApi, type UseBoundStore } from 'zustand';
import type { Conversation, Message, Group } from '../types';
import * as convoApi from '../api/conversations';
import * as userApi from '../api/users';
import * as groupApi from '../api/groups';
import { useAccountsStore } from './accounts';

/**
 * Chat store —— 按 active 账号隔离数据，顶层暴露当前账号的扁平视图。
 *
 * 内部 `data: Record<userId, ChatData>` 存所有账号的切片；
 * 顶层扁平字段（conversations / messages / currentConvoId 等）始终反映当前 active 账号，
 * 由 subscribe 同步刷新。这样组件无需改动订阅方式（useChatStore(s => s.conversations) 仍可用）。
 *
 * 切换账号时：accounts.activeId 变化 → 顶层视图刷新为新账号切片。
 */

interface ChatData {
  conversations: Conversation[];
  currentConvoId: string | null;
  messages: Record<string, Message[]>;
  typingUsers: Record<string, string[]>;
  onlineUsers: Record<string, boolean>;
  userNames: Record<string, string>;
  groupDetails: Record<string, Group>;
  unreadCount: Record<string, number>;
  chatViewActive: boolean;
  initialized: boolean;
}

const emptySlice = (): ChatData => ({
  conversations: [],
  currentConvoId: null,
  messages: {},
  typingUsers: {},
  onlineUsers: {},
  userNames: {},
  groupDetails: {},
  unreadCount: {},
  chatViewActive: true,
  initialized: false,
});

interface ChatState extends ChatData {
  /** 当前账号 userId（只读派生） */
  activeUserId: string | null;

  // —— actions ——
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
  clearMessages: (convoId: string) => void;
  setChatViewActive: (active: boolean) => void;
  handleMessageRecalled: (convoId: string, msgId: string) => void;
}

/** 账号隔离的存储（非响应式，仅内部用） */
const perUser: Record<string, ChatData> = {};

function getSlice(uid: string | null): ChatData {
  if (!uid) return emptySlice();
  if (!perUser[uid]) perUser[uid] = emptySlice();
  return perUser[uid];
}

/** 把某账号切片的内容同步到顶层 state */
function viewOf(uid: string | null): Partial<ChatState> {
  const s = getSlice(uid);
  return {
    activeUserId: uid,
    conversations: s.conversations,
    currentConvoId: s.currentConvoId,
    messages: s.messages,
    typingUsers: s.typingUsers,
    onlineUsers: s.onlineUsers,
    userNames: s.userNames,
    groupDetails: s.groupDetails,
    unreadCount: s.unreadCount,
    chatViewActive: s.chatViewActive,
  };
}

/** 修改当前账号切片并刷新顶层视图 */
function mutate(
  set: (fn: (s: ChatState) => Partial<ChatState>) => void,
  patch: (s: ChatData) => Partial<ChatData>
) {
  const uid = useAccountsStore.getState().active()?.userId ?? null;
  if (!uid) return;
  const slice = getSlice(uid);
  Object.assign(slice, patch(slice));
  set(() => viewOf(uid));
}

const GLOBAL_KEY = '__golang_qq_chat_store__';
const g = globalThis as { [k: string]: unknown };

export const useChatStore: UseBoundStore<StoreApi<ChatState>> =
  (g[GLOBAL_KEY] as UseBoundStore<StoreApi<ChatState>> | undefined) ?? create<ChatState>((set, get) => {
  // 订阅账号切换：active 变化时刷新顶层视图为新账号切片
  useAccountsStore.subscribe(() => {
    const uid = useAccountsStore.getState().active()?.userId ?? null;
    set(() => viewOf(uid));
  });

  const initialUid = useAccountsStore.getState().active()?.userId ?? null;

  return {
    ...viewOf(initialUid) as ChatState,
    activeUserId: initialUid,

    fetchConversations: async () => {
      const convos = await convoApi.getConversations();
      const sorted = [...convos].sort((a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
      mutate(set, () => ({ conversations: sorted, initialized: true }));
    },

    selectConversation: async (id) => {
      mutate(set, (s) => {
        const { [id]: _, ...rest } = s.unreadCount;
        return { currentConvoId: id, unreadCount: rest };
      });
      const cur = getSlice(useAccountsStore.getState().active()?.userId ?? null);
      if (!cur.messages[id]) {
        const msgs = await convoApi.getMessages(id);
        mutate(set, (s) => ({
          messages: { ...s.messages, [id]: msgs.reverse() },
        }));
      }
    },

    addMessage: (msg) => {
      const uid = useAccountsStore.getState().active()?.userId ?? null;
      if (!uid) return;
      const slice = getSlice(uid);
      const convoMsgs = slice.messages[msg.conversation_id] || [];
      slice.messages = { ...slice.messages, [msg.conversation_id]: [...convoMsgs, msg] };
      slice.conversations = [
        ...slice.conversations.map((c) =>
          c.id === msg.conversation_id
            ? { ...c, last_message: { content: msg.content, sender_id: msg.sender_id, type: msg.type, created_at: msg.created_at }, updated_at: msg.created_at }
            : c
        ).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
      ];
      const viewing = slice.chatViewActive && slice.currentConvoId === msg.conversation_id;
      if (viewing) {
        // 正在查看该会话：未读恒为 0，来消息时主动清除（防历史残留/重复投递）
        if (slice.unreadCount[msg.conversation_id]) {
          const { [msg.conversation_id]: _, ...rest } = slice.unreadCount;
          slice.unreadCount = rest;
        }
      } else {
        slice.unreadCount = {
          ...slice.unreadCount,
          [msg.conversation_id]: (slice.unreadCount[msg.conversation_id] || 0) + 1,
        };
      }
      set(() => viewOf(uid));
    },

    setTyping: (convoId, userId) => {
      mutate(set, (s) => {
        const users = s.typingUsers[convoId] || [];
        if (users.includes(userId)) return {};
        return { typingUsers: { ...s.typingUsers, [convoId]: [...users, userId] } };
      });
      setTimeout(() => {
        mutate(set, (s) => ({
          typingUsers: {
            ...s.typingUsers,
            [convoId]: (s.typingUsers[convoId] || []).filter((u) => u !== userId),
          },
        }));
      }, 3000);
    },

    setUserOnline: (userId) => {
      mutate(set, (s) => ({
        onlineUsers: { ...s.onlineUsers, [userId]: true },
      }));
    },

    setUserOffline: (userId) => {
      mutate(set, (s) => {
        const { [userId]: _, ...rest } = s.onlineUsers;
        return { onlineUsers: rest };
      });
    },

    fetchUserName: async (userId) => {
      const uid = useAccountsStore.getState().active()?.userId ?? null;
      if (!uid) return;
      if (getSlice(uid).userNames[userId]) return;
      try {
        // 按 ID 直接查询（旧实现用 searchUsers 按用户名搜 ObjectID，永远匹配不到）
        const user = await userApi.getUser(userId);
        if (user) {
          mutate(set, (s) => ({
            userNames: { ...s.userNames, [userId]: user.nickname || user.username },
          }));
        }
      } catch {
        // ignore
      }
    },

    createGroup: async (name, memberIds) => {
      const res = await groupApi.createGroup(name, '', memberIds);
      await get().fetchConversations();
      const convo = res.conversation as { id?: string } | undefined;
      if (convo?.id) {
        get().selectConversation(convo.id);
      }
    },

    fetchGroupDetails: async (groupId) => {
      const uid = useAccountsStore.getState().active()?.userId ?? null;
      if (!uid) return;
      if (getSlice(uid).groupDetails[groupId]) return;
      try {
        const group = await groupApi.getGroup(groupId);
        mutate(set, (s) => ({ groupDetails: { ...s.groupDetails, [groupId]: group } }));
      } catch {
        // ignore
      }
    },

    addGroupMember: async (groupId, userId) => {
      await groupApi.addGroupMember(groupId, userId);
      mutate(set, (s) => {
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
      mutate(set, (s) => {
        const { [convoId]: _, ...rest } = s.unreadCount;
        return { unreadCount: rest };
      });
    },

    setChatViewActive: (active) => {
      mutate(set, (s) => {
        const patch: Partial<ChatData> = { chatViewActive: active };
        // 回到聊天视图且当前有打开的会话 → 视为已读，清除其未读
        if (active && s.currentConvoId && s.unreadCount[s.currentConvoId]) {
          const { [s.currentConvoId]: _, ...rest } = s.unreadCount;
          patch.unreadCount = rest;
        }
        return patch;
      });
    },

    clearMessages: (convoId) => {
      mutate(set, (s) => {
        const { [convoId]: _, ...rest } = s.messages;
        return {
          messages: rest,
          // 同步清掉会话列表的最近消息预览（与 QQ 行为一致）
          conversations: s.conversations.map((c) =>
            c.id === convoId ? { ...c, last_message: undefined } : c
          ),
        };
      });
    },

    handleMessageRecalled: (convoId, msgId) => {
      mutate(set, (s) => {
        const msgs = s.messages[convoId];
        if (!msgs) return {};
        return {
          messages: {
            ...s.messages,
            [convoId]: msgs.map((m) =>
              m.id === msgId ? { ...m, type: 'system' as const, content: '该消息已撤回' } : m
            ),
          },
        };
      });
    },
  };
});

g[GLOBAL_KEY] = useChatStore;
