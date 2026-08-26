import { create } from 'zustand';

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

export const useUIStore = create<UIState>((set) => ({
  addFriendOpen: false,
  createGroupOpen: false,
  openAddFriend: () => set({ addFriendOpen: true }),
  closeAddFriend: () => set({ addFriendOpen: false }),
  openCreateGroup: () => set({ createGroupOpen: true }),
  closeCreateGroup: () => set({ createGroupOpen: false }),
}));
