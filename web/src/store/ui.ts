import { create, type StoreApi, type UseBoundStore } from 'zustand';

/**
 * 全局 UI 弹窗开关 —— 供 Sidebar / ChatArea 的"更多"菜单等跨组件触发。
 */
interface UIState {
  addFriendOpen: boolean;
  createGroupOpen: boolean;
  openAddFriend: () => void;
  closeAddFriend: () => void;
  openCreateGroup: () => void;
  closeCreateGroup: () => void;
}

const GLOBAL_KEY = '__golang_qq_ui_store__';
const g = globalThis as { [k: string]: unknown };

export const useUIStore: UseBoundStore<StoreApi<UIState>> =
  (g[GLOBAL_KEY] as UseBoundStore<StoreApi<UIState>> | undefined) ?? create<UIState>((set) => ({
  addFriendOpen: false,
  createGroupOpen: false,
  openAddFriend: () => set({ addFriendOpen: true }),
  closeAddFriend: () => set({ addFriendOpen: false }),
  openCreateGroup: () => set({ createGroupOpen: true }),
  closeCreateGroup: () => set({ createGroupOpen: false }),
}));

g[GLOBAL_KEY] = useUIStore;
