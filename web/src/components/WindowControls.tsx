import { useEffect, useState } from 'react';
import { CloseIcon, MaximizeIcon, MinimizeIcon } from './icons';

declare global {
  interface Window {
    win?: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      isMaximized: () => Promise<boolean>;
      onMaximizeChange: (cb: (v: boolean) => void) => () => void;
    };
  }
}

/**
 * 无边框窗口控制按钮（最小化 / 最大化 · 还原 / 关闭）。
 * 仅 Electron 客户端渲染（window.win 存在）；网页态不显示，避免无效装饰。
 */
export function WindowControls() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!window.win) return;
    let disposed = false;
    window.win.isMaximized().then((v) => { if (!disposed) setMaximized(v); }).catch(() => {});
    const off = window.win.onMaximizeChange((v) => setMaximized(v));
    return () => { disposed = true; off?.(); };
  }, []);

  if (!window.win) return null;

  return (
    <div className="win-controls">
      <button className="win-btn" onClick={() => window.win?.minimize()} title="最小化" aria-label="最小化">
        <MinimizeIcon size={16} />
      </button>
      <button className="win-btn" onClick={() => window.win?.maximize()} title={maximized ? '还原' : '最大化'} aria-label={maximized ? '还原' : '最大化'}>
        {maximized ? <MinimizeIcon size={16} /> : <MaximizeIcon size={16} />}
      </button>
      <button className="win-btn win-btn-close" onClick={() => window.win?.close()} title="关闭" aria-label="关闭">
        <CloseIcon size={16} />
      </button>
    </div>
  );
}
