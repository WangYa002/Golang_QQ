import { useAccountsStore } from '../store/accounts';

/**
 * API 地址策略：
 * - 网页模式（默认）：走相对路径 /api，由 Vite dev proxy 或同域反向代理转发
 * - 客户端模式（Electron 打包）：构建时注入 VITE_API_BASE=http://localhost:8080/api，
 *   请求直接打到后端，绕开 file:// 协议下相对路径失效的问题
 */
export const API_BASE: string =
  (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api';

/** 静态资源（/uploads/...）补全为绝对地址；网页模式下返回原样相对路径 */
export function mediaUrl(url: string | undefined | null): string {
  if (!url) return '';
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  const origin = API_BASE.match(/^https?:\/\/[^/]+/)?.[0] ?? '';
  return `${origin}${url}`;
}

/** 用户 avatar 字段 → Avatar 组件的 src；无头像时返回 undefined 走首字母兜底 */
export function avatarSrc(avatar: string | undefined | null): string | undefined {
  return avatar ? mediaUrl(avatar) : undefined;
}

function getToken(): string | null {
  // 从多账号管理器读取当前 active 账号 token
  // accounts store 不依赖 client，无循环依赖
  const acc = useAccountsStore.getState().active();
  return acc?.token ?? null;
}

/** 带鉴权的请求头（不含 Content-Type，供 FormData 等使用） */
export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** 带鉴权的 JSON 请求头（供 SSE 等非 request() 封装的调用使用） */
export function authJsonHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...authHeaders(),
  };
}

export async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'request failed' }));
    throw new Error(err.error || 'request failed');
  }
  return res.json();
}

export async function uploadFile(file: File): Promise<{ url: string; filename: string }> {
  const token = getToken();
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) throw new Error('upload failed');
  return res.json();
}
