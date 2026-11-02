import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  active?: boolean;
  danger?: boolean;
  children: ReactNode;
}

/**
 * 统一图标按钮：方/圆底 + hover，无内联颜色，适合工具栏与面板。
 */
export function IconButton({
  label,
  size = 'md',
  active = false,
  danger = false,
  children,
  className = '',
  ...rest
}: IconButtonProps) {
  const classes = [
    'ui-icon-btn',
    `ui-icon-btn-${size}`,
    active ? 'is-active' : '',
    danger ? 'is-danger' : '',
    className,
  ].filter(Boolean).join(' ');
  return (
    <button className={classes} title={label} aria-label={label} {...rest}>
      {children}
    </button>
  );
}
