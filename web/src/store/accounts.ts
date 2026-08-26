import { create } from 'zustand';
import type { User } from '../types';

/**
 * 多账号管理器。
 *
 * 一个"账号"= 一个登录态（userId + token + user 资料）。
 * 多账号间数据通过 chat store 按 userId 隔离，互不串扰。
 *
 * 持久化结构（localStorage['golang_qq_accounts']）：
 *   { accounts: Account[], activeId: string | null }
 * 首次启动时，若存在旧的单值 token，自动迁移为单账号。
 */

export interface Account {
  userId: string;
  token: string;
  user: User;
}

interface AccountsState {
  accounts: Account[];
  activeId: string | null;

  /** 当前激活的账号（null 表示未登录任何账号） */
  active: () => Account | null;

  /** 新增账号并切换为当前账号（登录成功后调用） */
  addAccount: (token: string, user: User) => void;

  /** 切换当前账号 */
  switchAccount: (userId: string) => void;

  /** 移除某账号；若移除的是当前账号，自动切到第一个剩余账号 */
  removeAccount: (userId: string) => void;

  /** 更新某账号的 user 资料（fetchMe 后调用） */
  updateAccountUser: (userId: string, user: User) => void;
}

const STORAGE_KEY = 'golang_qq_accounts';
const LEGACY_TOKEN_KEY = 'token';

/** 读取并迁移旧的单值 token（向后兼容） */
function loadPersisted(): { accounts: Account[]; activeId: string | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.accounts)) {
        return { accounts: parsed.accounts, activeId: parsed.activeId ?? null };
      }
    }
  } catch {
    // 损坏的 JSON，忽略
  }

  // 旧版单 token 迁移：仅有 token 无法还原 user，交由 auth store 在 fetchMe 后补全。
  // 这里仅返回空，由 auth.ts 处理迁移（auth.ts 需 token 才能 fetchMe）。
  const legacyToken = localStorage.getItem(LEGACY_TOKEN_KEY);
  if (legacyToken) {
    // 临时账号，userId 用占位符，fetchMe 后会被 addAccount 覆盖
    return {
      accounts: [{ userId: '__legacy__', token: legacyToken, user: { id: '__legacy__', username: '', nickname: '', avatar: '', bio: '', email: '', status: 'online' } }],
      activeId: '__legacy__',
    };
  }
  return { accounts: [], activeId: null };
}

function persist(state: { accounts: Account[]; activeId: string | null }) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export const useAccountsStore = create<AccountsState>((set, get) => {
  const initial = loadPersisted();

  return {
    accounts: initial.accounts,
    activeId: initial.activeId,

    active: () => {
      const { accounts, activeId } = get();
      if (!activeId) return null;
      return accounts.find((a) => a.userId === activeId) ?? null;
    },

    addAccount: (token, user) => {
      set((s) => {
        // 已存在则更新 token/user，否则新增
        const exists = s.accounts.some((a) => a.userId === user.id);
        const accounts = exists
          ? s.accounts.map((a) => (a.userId === user.id ? { ...a, token, user } : a))
          : [...s.accounts, { userId: user.id, token, user }];
        const next = { accounts, activeId: user.id };
        persist(next);
        return next;
      });
      // 清理旧版单 token（迁移完成）
      if (localStorage.getItem(LEGACY_TOKEN_KEY)) {
        localStorage.removeItem(LEGACY_TOKEN_KEY);
      }
    },

    switchAccount: (userId) => {
      set((s) => {
        if (!s.accounts.some((a) => a.userId === userId)) return s;
        const next = { accounts: s.accounts, activeId: userId };
        persist(next);
        return { activeId: userId };
      });
    },

    removeAccount: (userId) => {
      set((s) => {
        const accounts = s.accounts.filter((a) => a.userId !== userId);
        let activeId = s.activeId;
        if (activeId === userId) {
          activeId = accounts[0]?.userId ?? null;
        }
        const next = { accounts, activeId };
        persist(next);
        return next;
      });
    },

    updateAccountUser: (userId, user) => {
      set((s) => {
        const accounts = s.accounts.map((a) => (a.userId === userId ? { ...a, user } : a));
        persist({ accounts, activeId: s.activeId });
        return { accounts };
      });
    },
  };
});
