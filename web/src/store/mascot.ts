import { create, type StoreApi, type UseBoundStore } from 'zustand';

/** 小Q 皮肤：各部位配色 */
export interface MascotSkin {
  id: string;
  name: string;
  /** 天线/耳朵/发光件（主题色） */
  accent: string;
  accentSoft: string;
  /** 机身描边 */
  stroke: string;
  /** 屏幕底色（深色） */
  screen: string;
  /** 眼睛/嘴（屏幕上的亮色） */
  eye: string;
  /** 腮红 */
  blush: string;
}

export const MASCOT_SKINS: MascotSkin[] = [
  { id: 'classic', name: '经典', accent: '#7a6cf0', accentSoft: '#8f83f3', stroke: '#c9c4f5', screen: '#201f3a', eye: '#8ef0d2', blush: '#ffb3c7' },
  { id: 'ocean', name: '海洋', accent: '#1d9bf0', accentSoft: '#4bb3f5', stroke: '#b9dcf7', screen: '#0e2a3d', eye: '#7ee3ff', blush: '#ffc4d6' },
  { id: 'mint', name: '薄荷', accent: '#0bba7d', accentSoft: '#3dd99e', stroke: '#b8ead4', screen: '#0d3325', eye: '#a5f3c9', blush: '#ffc9b8' },
  { id: 'sakura', name: '樱花', accent: '#f06fa0', accentSoft: '#f795ba', stroke: '#f5cddd', screen: '#3d1a2b', eye: '#ffd1e3', blush: '#ff9fbf' },
  { id: 'sunset', name: '落日', accent: '#f59b00', accentSoft: '#ffb84d', stroke: '#ffe3b3', screen: '#3a2a10', eye: '#ffe0a3', blush: '#ff9d9d' },
  { id: 'midnight', name: '暗夜', accent: '#5c6470', accentSoft: '#8b93a1', stroke: '#3a414c', screen: '#14171c', eye: '#9db8ff', blush: '#7d8ba3' },
];

/** 由自定义主色派生皮肤 */
export function skinFromColor(color: string): MascotSkin {
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  const mix = (hex: string) => {
    const m = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    return '#' + [0, 1, 2].map((i) => Math.round(m[i] * 0.55 + [r, g, b][i] * 0.45).toString(16).padStart(2, '0')).join('');
  };
  const dark = (f: number) => '#' + [r, g, b].map((v) => Math.round(v * f).toString(16).padStart(2, '0')).join('');
  return {
    id: 'custom',
    name: '自定义',
    accent: color,
    accentSoft: mix('#ffffff'),
    stroke: mix('#e8e8f0'),
    screen: dark(0.28),
    eye: mix('#d8fff0'),
    blush: mix('#ffb3c7'),
  };
}

interface MascotState {
  skin: MascotSkin;
  setSkin: (skin: MascotSkin) => void;
}

const STORAGE_KEY = '__golang_qq_mascot_skin__';

function readInitial(): MascotSkin {
  if (typeof window === 'undefined') return MASCOT_SKINS[0];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as MascotSkin;
  } catch { /* ignore */ }
  return MASCOT_SKINS[0];
}

const GLOBAL_KEY = '__golang_qq_mascot_store__';
const g = globalThis as { [k: string]: unknown };

export const useMascotStore: UseBoundStore<StoreApi<MascotState>> =
  (g[GLOBAL_KEY] as UseBoundStore<StoreApi<MascotState>> | undefined) ?? create<MascotState>((set) => ({
  skin: readInitial(),
  setSkin: (skin) => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(skin)); } catch { /* ignore */ }
    set({ skin });
  },
}));

g[GLOBAL_KEY] = useMascotStore;
