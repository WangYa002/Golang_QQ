import { create, type StoreApi, type UseBoundStore } from 'zustand';

export type Theme = 'dark' | 'light';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

const STORAGE_KEY = '__golang_qq_theme__';

function applyTheme(theme: Theme) {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

function readInitial(): Theme {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'dark' ? 'dark' : 'light'; // 默认浅色（Codex 风暖纸色调）
}

const initial = readInitial();
applyTheme(initial);

const GLOBAL_KEY = '__golang_qq_theme_store__';
const g = globalThis as { [k: string]: unknown };

export const useThemeStore: UseBoundStore<StoreApi<ThemeState>> =
  (g[GLOBAL_KEY] as UseBoundStore<StoreApi<ThemeState>> | undefined) ??
  create<ThemeState>((set, get) => ({
    theme: initial,
    setTheme: (theme) => {
      window.localStorage.setItem(STORAGE_KEY, theme);
      applyTheme(theme);
      set({ theme });
    },
    toggle: () => {
      const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
      window.localStorage.setItem(STORAGE_KEY, next);
      applyTheme(next);
      set({ theme: next });
    },
  }));

g[GLOBAL_KEY] = useThemeStore;
