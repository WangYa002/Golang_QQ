import { create } from 'zustand';
import type { User } from '../types';
import * as authApi from '../api/auth';
import * as userApi from '../api/users';
import { useAccountsStore } from './accounts';

/**
 * Auth store —— 对外接口保持单账号语义（token/user/isAuthenticated/login/register/logout/fetchMe），
 * 内部委托给 accounts 管理器实现多账号。
 *
 * 多账号语义：
 *  - login/register 成功后，新增一个账号并切换为 active（而非覆盖）。
 *  - user/token 始终反映当前 active 账号。
 *  - logout 仅登出当前 active 账号，自动切到下一个；无账号则回到登录页。
 */

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, nickname: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
}

/** 从 accounts 管理器同步当前 active 账号到本 store 的派生字段 */
function syncFromAccounts(): Pick<AuthState, 'token' | 'user' | 'isAuthenticated'> {
  const acc = useAccountsStore.getState().active();
  return {
    token: acc?.token ?? null,
    user: acc?.user ?? null,
    isAuthenticated: !!acc,
  };
}

export const useAuthStore = create<AuthState>((set) => {
  const initial = syncFromAccounts();

  // 订阅 accounts 变化，保持派生字段同步
  useAccountsStore.subscribe(() => {
    set(syncFromAccounts());
  });

  return {
    ...initial,

    login: async (username, password) => {
      const res = await authApi.login(username, password);
      // 写入 accounts（新增或更新）并自动切换为 active
      useAccountsStore.getState().addAccount(res.token, res.user);
      set(syncFromAccounts());
    },

    register: async (username, password, nickname) => {
      const res = await authApi.register(username, password, nickname);
      useAccountsStore.getState().addAccount(res.token, res.user);
      set(syncFromAccounts());
    },

    logout: () => {
      const acc = useAccountsStore.getState().active();
      if (acc) {
        useAccountsStore.getState().removeAccount(acc.userId);
      }
      set(syncFromAccounts());
    },

    fetchMe: async () => {
      const acc = useAccountsStore.getState().active();
      if (!acc) return;
      try {
        const user = await userApi.getMe();
        useAccountsStore.getState().updateAccountUser(acc.userId, user);
        set(syncFromAccounts());
      } catch {
        // token 失效等，忽略
      }
    },
  };
});
