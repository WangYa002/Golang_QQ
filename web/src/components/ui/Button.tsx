import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconRight?: ReactNode;
  block?: boolean;
  loading?: boolean;
}

/**
 * 统一按钮。变体、尺寸、加载态全部由 CSS 类封装，禁用内联颜色。
 */
export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  iconRight,
  block = false,
  loading = false,
  children,
  className = '',
  disabled,
  ...rest
}: ButtonProps) {
  const classes = [
    'ui-btn',
    `ui-btn-${variant}`,
    `ui-btn-${size}`,
    block ? 'ui-btn-block' : '',
    loading ? 'ui-btn-loading' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button className={classes} disabled={disabled || loading} {...rest}>
      {icon && <span className="ui-btn-icon">{icon}</span>}
      {children && <span className="ui-btn-label">{children}</span>}
      {iconRight && <span className="ui-btn-icon">{iconRight}</span>}
    </button>
  );
}
