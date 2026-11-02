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

/** 每个会话的本地偏好（QQ 语义：置顶/免打扰为机器偏好；删除仅移出列表，新消息即恢复） */
export interface ConvoPref {
  pinned?: boolean;
  muted?: boolean;
  hidden?: boolean;
}

interface ChatData {
  conversations: Conversation[];
  currentConvoId: string | null;
  messages: Record<string, Message[]>;
  typingUsers: Record<string, string[]>;
  onlineUsers: Record<string, boolean>;
  userNames: Record<string, string>;
  userAvatars: Record<string, string>;
  groupDetails: Record<string, Group>;
  unreadCount: Record<string, number>;
  convPrefs: Record<string, ConvoPref>;
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
  userAvatars: {},
  groupDetails: {},
  unreadCount: {},
  convPrefs: {},
  chatViewActive: true,
  initialized: false,
});

// —— 会话偏好持久化（按账号隔离） ——
const prefsKey = (uid: string) => `qq_conv_prefs_${uid}`;

function loadPrefs(uid: string): Record<string, ConvoPref> {
  try {
    const raw = localStorage.getItem(prefsKey(uid));
    if (raw) return JSON.parse(raw);
  } catch {
    // 损坏数据则忽略
  }
  return {};
}

function savePrefs(uid: string, prefs: Record<string, ConvoPref>) {
  try {
    localStorage.setItem(prefsKey(uid), JSON.stringify(prefs));
  } catch {
    // 存储失败不影响运行
  }
}

function withoutKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}

interface ChatState extends ChatData {
  /** 当前账号 userId（只读派生） */
  activeUserId: string | null;

  // —— actions ——
  fetchConversations: () => Promise<void>;
  selectConversation: (id: string) => Promise<void>;
  /** 清空当前选中会话（退群 / 删除会话后回到空态） */
  clearSelection: () => void;
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
  setConvPref: (convoId: string, patch: ConvoPref) => void;
  hideConversation: (convoId: string) => void;
}

/** 账号隔离的存储（非响应式，仅内部用） */
const perUser: Record<string, ChatData> = {};

function getSlice(uid: string | null): ChatData {
  if (!uid) return emptySlice();
  if (!perUser[uid]) perUser[uid] = { ...emptySlice(), convPrefs: loadPrefs(uid) };
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
    userAvatars: s.userAvatars,
    groupDetails: s.groupDetails,
    unreadCount: s.unreadCount,
    convPrefs: s.convPrefs,
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
        return { currentConvoId: id, unreadCount: withoutKey(s.unreadCount, id) };
      });
      const cur = getSlice(useAccountsStore.getState().active()?.userId ?? null);
      if (!cur.messages[id]) {
        const msgs = await convoApi.getMessages(id);
        mutate(set, (s) => ({
          messages: { ...s.messages, [id]: msgs.reverse() },
        }));
      }
    },

    clearSelection: () => {
      mutate(set, () => ({ currentConvoId: null }));
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
      // 免打扰的会话不产生未读；已被删除（隐藏）的会话收到新消息时恢复显示（QQ 行为）
      const pref = slice.convPrefs[msg.conversation_id];
      let prefsDirty = false;
      if (pref?.hidden) {
        slice.convPrefs = withoutKey(slice.convPrefs, msg.conversation_id);
        prefsDirty = true;
      }
      const muted = !!pref?.muted;
      const viewing = slice.chatViewActive && slice.currentConvoId === msg.conversation_id;
      if (viewing) {
        // 正在查看该会话：未读恒为 0，来消息时主动清除（防历史残留/重复投递）
        if (slice.unreadCount[msg.conversation_id]) {
          slice.unreadCount = withoutKey(slice.unreadCount, msg.conversation_id);
        }
      } else if (!muted) {
        slice.unreadCount = {
          ...slice.unreadCount,
          [msg.conversation_id]: (slice.unreadCount[msg.conversation_id] || 0) + 1,
        };
      }
      if (prefsDirty) savePrefs(uid, slice.convPrefs);
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
        return { onlineUsers: withoutKey(s.onlineUsers, userId) };
      });
    },

    fetchUserName: async (userId) => {
      const uid = useAccountsStore.getState().active()?.userId ?? null;
      if (!uid) return;
      if (getSlice(uid).userNames[userId] !== undefined && getSlice(uid).userAvatars[userId] !== undefined) return;
      try {
        // 按 ID 直接查询（旧实现用 searchUsers 按用户名搜 ObjectID，永远匹配不到）
        const user = await userApi.getUser(userId);
        if (user) {
          mutate(set, (s) => ({
            userNames: { ...s.userNames, [userId]: user.nickname || user.username },
            userAvatars: { ...s.userAvatars, [userId]: user.avatar || '' },
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
        return { groupDetails: withoutKey(s.groupDetails, groupId) };
      });
      get().fetchGroupDetails(groupId);
    },

    leaveGroup: async (groupId, userId) => {
      await groupApi.removeGroupMember(groupId, userId);
      await get().fetchConversations();
    },

    markAsRead: (convoId) => {
      mutate(set, (s) => {
        return { unreadCount: withoutKey(s.unreadCount, convoId) };
      });
    },

    setChatViewActive: (active) => {
      mutate(set, (s) => {
        const patch: Partial<ChatData> = { chatViewActive: active };
        // 回到聊天视图且当前有打开的会话 → 视为已读，清除其未读
        if (active && s.currentConvoId && s.unreadCount[s.currentConvoId]) {
          patch.unreadCount = withoutKey(s.unreadCount, s.currentConvoId);
        }
        return patch;
      });
    },

    clearMessages: (convoId) => {
      mutate(set, (s) => {
        return {
          messages: withoutKey(s.messages, convoId),
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

    setConvPref: (convoId, patch) => {
      const uid = useAccountsStore.getState().active()?.userId ?? null;
      if (!uid) return;
      const slice = getSlice(uid);
      slice.convPrefs = {
        ...slice.convPrefs,
        [convoId]: { ...(slice.convPrefs[convoId] || {}), ...patch },
      };
      savePrefs(uid, slice.convPrefs);
      set(() => viewOf(uid));
    },

    hideConversation: (convoId) => {
      const uid = useAccountsStore.getState().active()?.userId ?? null;
      if (!uid) return;
      const slice = getSlice(uid);
      slice.convPrefs = {
        ...slice.convPrefs,
        [convoId]: { ...(slice.convPrefs[convoId] || {}), hidden: true },
      };
      // 从列表移除后不再保留未读与消息缓存；若删除的是当前打开的会话则一并关闭
      if (slice.unreadCount[convoId]) {
        slice.unreadCount = withoutKey(slice.unreadCount, convoId);
      }
      slice.messages = withoutKey(slice.messages, convoId);
      if (slice.currentConvoId === convoId) slice.currentConvoId = null;
      savePrefs(uid, slice.convPrefs);
      set(() => viewOf(uid));
    },
  };
});

g[GLOBAL_KEY] = useChatStore;
