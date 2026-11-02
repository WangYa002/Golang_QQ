import type { CSSProperties } from 'react';
import { UsersIcon } from '../icons';

export type AvatarSize = 'sm' | 'md' | 'lg';

export interface AvatarProps {
  name: string;
  src?: string;
  size?: AvatarSize;
  variant?: 'user' | 'group';
  online?: boolean | null;
  showOnlineDot?: boolean;
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
}

// QQ 规格：会话列表 40px（md），群成员/顶栏 32px（sm），资料页 64px（lg）
const SIZES: Record<AvatarSize, number> = { sm: 32, md: 40, lg: 64 };

// 低饱和色板：去 AI 紫蓝渐变，改用可辨识的单色圆底
const COLORS = [
  '#37a3ff', '#7c6cf6', '#2fd18a', '#ffb020', '#ff6b8a',
  '#14b8a6', '#a06af9', '#3a86ff', '#f59b00', '#ff5b5b',
];

function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

/**
 * 统一头像（QQ NT 圆角方形）。用户头像为彩色底 + 首字母/图片；
 * 群头像为主色淡染底 + 群图标；可叠加在线状态点。
 */
export function Avatar({
  name,
  src,
  size = 'md',
  variant = 'user',
  online,
  showOnlineDot = false,
  onClick,
  className = '',
  style,
}: AvatarProps) {
  const px = SIZES[size];
  const label = (name || '?')[0]?.toUpperCase() || '?';

  const bg = variant === 'group'
    ? 'var(--accent-soft)'
    : hashColor(name);
  const color = variant === 'group' ? 'var(--accent)' : '#ffffff';

  return (
    <div
      className={`ui-avatar ${className}`}
      onClick={onClick}
      style={{
        width: px,
        height: px,
        background: src ? 'var(--bg-secondary)' : bg,
        color,
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : -1}
    >
      {src ? (
        <img src={src} alt={name} className="ui-avatar-img" />
      ) : variant === 'group' ? (
        <UsersIcon size={px * 0.45} />
      ) : (
        <span className="ui-avatar-label" style={{ fontSize: px * 0.38 }}>{label}</span>
      )}
      {showOnlineDot && (
        <span
          className="ui-avatar-dot"
          style={{ background: online ? 'var(--online)' : 'var(--offline)' }}
        />
      )}
    </div>
  );
}
