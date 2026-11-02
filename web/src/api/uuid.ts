/**
 * UUID 生成：优先 crypto.randomUUID（安全上下文），降级时间戳+随机数
 * （纯 HTTP 站点上 crypto.randomUUID 不存在，直接调用会抛 TypeError 导致发送失败）。
 */
export function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 6)}`;
}
