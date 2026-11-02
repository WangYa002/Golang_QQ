import { useAuthStore } from '../store/auth';
import AccountSwitcher from './AccountSwitcher';
import { ThemeToggle } from './ui/ThemeToggle';
import { WindowControls } from './WindowControls';

const DEFAULT_SIG = '这个人很懒，什么都没留下';

/**
 * 顶部账号栏。
 * 左：应用图标 +「QQ」字标（对齐下方第一栏/左栏）。
 * 中：账号信息（头像 + 昵称 + 个性签名，对齐下方第二栏/消息面板），点头像弹出账号卡片。
 * 右：主题切换 + 窗口控制（仅 Electron 生效）。
 */
export default function TopBar({ onOpenProfile }: { onOpenProfile: (userId: string) => void }) {
  const user = useAuthStore((s) => s.user);
  const nickname = user?.nickname || user?.username || '';
  const signature = user?.bio || DEFAULT_SIG;

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <img src="/icons/icon-48.png" alt="Golang QQ" className="brand-icon" draggable={false} />
        <span className="brand-font">QQ</span>
      </div>
      <div className="topbar-account">
        <AccountSwitcher onOpenProfile={onOpenProfile} />
        <div className="topbar-id">
          <span className="topbar-nick">{nickname}</span>
          <span className="topbar-sig">{signature}</span>
        </div>
      </div>
      <div className="topbar-right">
        <ThemeToggle />
        <WindowControls />
      </div>
    </header>
  );
}
