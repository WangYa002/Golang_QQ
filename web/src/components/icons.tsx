// 集中管理全站内联 SVG 图标，避免重复代码。
// 所有图标默认使用 currentColor，size 可通过 props 调整。

interface IconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

/** 消息气泡（Tab、空状态、品牌） */
export function MessageIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

/** 多人（联系人、群成员） */
export function UsersIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

/** 单人（个人资料） */
export function UserIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

/** 锁（密码） */
export function LockIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

/** 电话（顶栏装饰） */
export function PhoneIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

/** 视频（顶栏装饰） */
export function VideoIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

/** 挂断电话 */
export function HangupIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

/** 麦克风关闭 */
export function MicOffIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

/** 摄像头关闭 */
export function VideoOffIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M10.66 6H14a2 2 0 0 1 2 2v2.5l5.248-3.062A.5.5 0 0 1 22 7.87v8.196" />
      <path d="M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

/** 更多（三点） */
export function MoreIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </svg>
  );
}

/** 置顶图钉 */
export function PinIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <line x1="12" y1="17" x2="12" y2="22" />
      <path d="M5 17h14l-1.5-4.5L15 10V4H9v6l-2.5 2.5z" />
    </svg>
  );
}

/** 免打扰（静音铃） */
export function BellOffIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      <path d="M18.63 13A17.89 17.89 0 0 1 18 8" />
      <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" />
      <path d="M18 8a6 6 0 0 0-9.33-5" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

/** 删除（垃圾桶） */
export function TrashIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

/** 仪表盘（管理后台） */
export function DashboardIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

/** 搜索（放大镜） */
export function SearchIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

/** 关闭（X） */
export function CloseIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/** 发送（纸飞机） */
export function SendIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

/** 附件/回形针 */
export function PaperclipIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

/** 退出登录 */
export function LogoutIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

/** 添加好友（用户 + 加号） */
export function UserPlusIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="20" y1="8" x2="20" y2="14" />
      <line x1="23" y1="11" x2="17" y2="11" />
    </svg>
  );
}

/** 眼睛（密码可见） */
export function EyeIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** 眼睛-关（密码隐藏） */
export function EyeOffIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

/** 警告（错误提示圆圈带斜线） */
export function AlertIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

/** 对勾（选中） */
export function CheckIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} strokeWidth={2.5}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/** 加载中（圆环） */
export function SpinnerIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="10" strokeDasharray="31.4" strokeDashoffset="10" />
    </svg>
  );
}

/** 太阳（浅色模式） */
export function SunIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

/** 月亮（暗色模式） */
export function MoonIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

/** 表情（笑脸） */
export function SmileIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  );
}

/** 图片 */
export function ImageIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

/** 相机（换头像） */
export function CameraIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

/** 邮件 */
export function MailIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

/** 加号（新建/添加） */
export function PlusIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

/** 投屏/共享 */
export function ScreenShareIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="6" y1="17" x2="6" y2="21" />
      <line x1="18" y1="17" x2="18" y2="21" />
      <polygon points="12 7 9 10 12 10 12 13 15 10 12 10" />
    </svg>
  );
}

/** 下箭头（折叠/下拉） */
export function ChevronDownIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/** 右箭头 */
export function ChevronRightIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}

/** 公告（喇叭） */
export function MegaphoneIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M3 11v3a1 1 0 0 0 1 1h2l3 4h1v-9H4a1 1 0 0 0-1 1z" />
      <path d="M7 7l9-3v16l-9-3" />
    </svg>
  );
}

/** 截图/裁剪 */
export function ScreenshotIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  );
}

/** 麦克风（语音） */
export function MicIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" />
    </svg>
  );
}

/** 云（天气） */
export function CloudIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M17.5 19a4.5 4.5 0 1 0-0.28-8.99A6 6 0 1 0 6 17.5" />
      <path d="M8 19h9.5" />
    </svg>
  );
}

/** 知识库（书本） */
export function BookIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M9 7h7" />
    </svg>
  );
}

/** 最小化（横线） */
export function MinimizeIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

/** 最大化（方框） */
export function MaximizeIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="5" y="5" width="14" height="14" rx="1" />
    </svg>
  );
}

/** 下载 */
export function DownloadIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
