import { create } from 'zustand';
import type { User } from '../types';
import * as authApi from '../api/auth';
import * as userApi from '../api/users';

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, nickname: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('token'),
  user: null,
  isAuthenticated: !!localStorage.getItem('token'),

  login: async (username, password) => {
    const res = await authApi.login(username, password);
    localStorage.setItem('token', res.token);
    set({ token: res.token, user: res.user, isAuthenticated: true });
  },

  register: async (username, password, nickname) => {
    const res = await authApi.register(username, password, nickname);
    localStorage.setItem('token', res.token);
    set({ token: res.token, user: res.user, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ token: null, user: null, isAuthenticated: false });
  },

  fetchMe: async () => {
    const user = await userApi.getMe();
    set({ user });
  },
}));
