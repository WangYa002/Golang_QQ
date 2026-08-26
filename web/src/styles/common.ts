// 全站复用的样式对象与交互处理器，避免在各组件中重复内联。
import type { CSSProperties } from 'react';

/** 标准输入框样式（深色主题） */
export const inputStyle: CSSProperties = {
  background: 'var(--bg-input)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border)',
  borderRadius: 10,
};

/**
 * 生成鼠标 hover 时切换背景色的处理器。
 * 默认 hover 色为 var(--bg-hover)，离开还原为透明。
 * 用于图标按钮、列表项等需要轻量 hover 反馈的元素。
 */
export function hoverHandlers(opts?: {
  hoverBg?: string;
  leaveBg?: string;
}) {
  const hoverBg = opts?.hoverBg ?? 'var(--bg-hover)';
  const leaveBg = opts?.leaveBg ?? 'transparent';
  return {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      e.currentTarget.style.background = hoverBg;
    },
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
      e.currentTarget.style.background = leaveBg;
    },
  };
}
