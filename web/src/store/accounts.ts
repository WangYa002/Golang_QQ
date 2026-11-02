import { create, type StoreApi, type UseBoundStore } from 'zustand';
import type { User } from '../types';

/**
 * 多账号管理器。
 *
 * 一个"账号"= 一个登录态（userId + token + user 资料）。
 * 多账号间数据通过 chat store 按 userId 隔离，互不串扰。
 *
 * 持久化策略（多窗口安全）：
 *  - 账号列表存 localStorage['golang_qq_accounts']（跨窗口共享已登录账号）；
 *    每次写入前先读最新列表再合并，避免用本窗口过时快照覆盖其他窗口的账号。
 *  - 当前激活账号存 sessionStorage['golang_qq_active']（每个标签页独立），
 *    因此不同窗口可分别登录不同账号互不干扰；刷新页面 sessionStorage 保留，
 *    登录态与会话列表不丢。
 *  - 监听 storage 事件：其他窗口增删账号时本窗口同步刷新列表（不动本窗口激活态）。
 *  - 新窗口首次打开（无 sessionStorage 激活态）时，默认激活最近操作过的账号（lastActive）。
 *
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

  /** 仅登出当前窗口（清除本窗口激活态，不删除共享账号列表；被顶号时用） */
  clearSessionActive: () => void;

  /** 更新某账号的 user 资料（fetchMe 后调用） */
  updateAccountUser: (userId: string, user: User) => void;
}

const STORAGE_KEY = 'golang_qq_accounts';
const ACTIVE_KEY = 'golang_qq_active';
const LEGACY_TOKEN_KEY = 'token';

/** 读取 localStorage 中最新账号列表（兼容旧格式 {accounts, activeId} 与裸数组） */
function loadAccounts(): Account[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.accounts)) return parsed.accounts;
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // 损坏的 JSON，忽略
  }
  return [];
}

/** 写入账号列表 + 最近激活账号（写入前基于最新列表，本函数只做持久化） */
function saveAccounts(accounts: Account[], lastActive: string | null) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ accounts, lastActive }));
}

/** 读取"最近激活"账号（新窗口默认激活用；兼容旧格式的 activeId 字段） */
function loadLastActive(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.lastActive === 'string') return parsed.lastActive;
      if (typeof parsed.activeId === 'string') return parsed.activeId; // 旧格式迁移
    }
  } catch {
    // ignore
  }
  return null;
}

/** 当前窗口独立激活态（sessionStorage） */
function loadSessionActive(): string | null {
  try {
    return sessionStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

function saveSessionActive(activeId: string | null) {
  try {
    if (activeId) sessionStorage.setItem(ACTIVE_KEY, activeId);
    else sessionStorage.removeItem(ACTIVE_KEY);
  } catch {
    // ignore
  }
}

/** 读取并迁移旧的单值 token（向后兼容） */
function loadPersisted(): { accounts: Account[]; activeId: string | null } {
  const accounts = loadAccounts();

  // 旧版单 token 迁移：仅有 token 无法还原 user，交由 auth store 在 fetchMe 后补全。
  // 这里仅返回空，由 auth.ts 处理迁移（auth.ts 需 token 才能 fetchMe）。
  const legacyToken = localStorage.getItem(LEGACY_TOKEN_KEY);
  if (legacyToken && accounts.length === 0) {
    // 临时账号，userId 用占位符，fetchMe 后会被 addAccount 覆盖
    return {
      accounts: [{ userId: '__legacy__', token: legacyToken, user: { id: '__legacy__', username: '', nickname: '', avatar: '', bio: '', email: '', status: 'online' } }],
      activeId: '__legacy__',
    };
  }

  // 当前窗口激活：sessionStorage 优先。
  // 新窗口（无 sessionStorage）不自动激活任何账号，回到登录页让用户主动登录，
  // 这样不同窗口可以分别登录不同账号（多用户同时在线）。
  // 注意：不依赖 localStorage 里的 lastActive 回退，否则新窗口会被强制激活到
  // 最近登录的账号，导致多个窗口都变成本地存储中最后一个账号，无法多账号同时在线。
  const sessionActive = loadSessionActive();
  const activeId = sessionActive && accounts.some((a) => a.userId === sessionActive)
    ? sessionActive
    : null;
  return { accounts, activeId };
}

const GLOBAL_KEY = '__golang_qq_accounts_store__';
const g = globalThis as { [k: string]: unknown };

export const useAccountsStore: UseBoundStore<StoreApi<AccountsState>> =
  (g[GLOBAL_KEY] as UseBoundStore<StoreApi<AccountsState>> | undefined) ?? create<AccountsState>((set, get) => {
  const initial = loadPersisted();

  // 跨窗口同步账号列表：storage 事件仅在其他窗口修改 localStorage 时触发，
  // 本窗口据此刷新列表，但保留本窗口的 sessionStorage 激活态（互不干扰）。
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key !== STORAGE_KEY) return;
      set((s) => {
        const accounts = loadAccounts();
        // 若其他窗口删除了当前激活账号，回退到第一个剩余账号
        const activeId = accounts.some((a) => a.userId === s.activeId) ? s.activeId : (accounts[0]?.userId ?? null);
        return { accounts, activeId };
      });
    });
  }

  return {
    accounts: initial.accounts,
    activeId: initial.activeId,

    active: () => {
      const { accounts, activeId } = get();
      if (!activeId) return null;
      return accounts.find((a) => a.userId === activeId) ?? null;
    },

    addAccount: (token, user) => {
      set(() => {
        // 基于 localStorage 最新列表合并，防止用本窗口过时快照覆盖其他窗口新增的账号
        const latest = loadAccounts();
        const exists = latest.some((a) => a.userId === user.id);
        const accounts = exists
          ? latest.map((a) => (a.userId === user.id ? { ...a, token, user } : a))
          : [...latest, { userId: user.id, token, user }];
        saveAccounts(accounts, user.id);
        saveSessionActive(user.id);
        return { accounts, activeId: user.id };
      });
      // 清理旧版单 token（迁移完成）
      if (localStorage.getItem(LEGACY_TOKEN_KEY)) {
        localStorage.removeItem(LEGACY_TOKEN_KEY);
      }
    },

    switchAccount: (userId) => {
      set((s) => {
        if (!loadAccounts().some((a) => a.userId === userId)) return s;
        saveSessionActive(userId);
        // 更新最近激活账号，供新窗口默认激活
        saveAccounts(loadAccounts(), userId);
        return { activeId: userId };
      });
    },

    removeAccount: (userId) => {
      set((s) => {
        const latest = loadAccounts().filter((a) => a.userId !== userId);
        let activeId = s.activeId;
        if (activeId === userId) {
          activeId = latest[0]?.userId ?? null;
        }
        saveAccounts(latest, activeId);
        saveSessionActive(activeId);
        return { accounts: latest, activeId };
      });
    },

    clearSessionActive: () => {
      set(() => {
        saveSessionActive(null);
        return { activeId: null };
      });
    },

    updateAccountUser: (userId, user) => {
      set((s) => {
        // 基于最新列表更新，保留其他窗口的账号
        const latest = loadAccounts().map((a) => (a.userId === userId ? { ...a, user } : a));
        saveAccounts(latest, s.activeId ?? loadLastActive());
        return { accounts: latest };
      });
    },
  };
});

g[GLOBAL_KEY] = useAccountsStore;
