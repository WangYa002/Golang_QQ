import { type ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  children: ReactNode;
}

/**
 * Portal —— 把子节点渲染到 document.body，脱离父级的层叠上下文。
 *
 * 用途：父容器带 `backdrop-filter`（glass 类）或 `overflow: hidden` 时，
 * 内部 `position: fixed` 的弹窗会被困在父级，无法相对视口定位。
 * 用 Portal 包裹后弹窗挂到 body，层级和定位恢复正常。
 */
export default function Portal({ children }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? createPortal(children, document.body) : null;
}
