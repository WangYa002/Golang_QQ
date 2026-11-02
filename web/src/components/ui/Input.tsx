import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix' | 'suffix'> {
  prefix?: ReactNode;
  suffix?: ReactNode;
}

/**
 * 统一输入框。可带前置/后置图标，聚焦态走全局 focus 令牌。
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ prefix, suffix, className = '', ...rest }, ref) {
    return (
      <div className={`ui-input ${className}`}>
        {prefix && <span className="ui-input-affix ui-input-prefix">{prefix}</span>}
        <input ref={ref} className="ui-input-field" {...rest} />
        {suffix && <span className="ui-input-affix ui-input-suffix">{suffix}</span>}
      </div>
    );
  },
);
