import { useMascotStore, type MascotSkin } from '../store/mascot';

/**
 * AI 助手卡通形象「小Q」——几何机器人（圆头 + 天线 + 眨眼 + 微笑腮红）。
 * 皮肤从全局 store 读取（可在 AI 面板换肤）；floating 开启待机浮动。
 */
export function Mascot({ size = 48, floating = false, skin: skinProp }: { size?: number; floating?: boolean; skin?: MascotSkin }) {
  const storeSkin = useMascotStore((s) => s.skin);
  const skin = skinProp ?? storeSkin;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="AI 助手小Q"
      className={floating ? 'mascot-bob' : undefined}
    >
      {/* 天线 */}
      <line x1="32" y1="8" x2="32" y2="14" stroke={skin.accent} strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="32" cy="6.5" r="3.4" fill={skin.accent} className="mascot-antenna" />
      {/* 耳朵 */}
      <rect x="4" y="27" width="5" height="12" rx="2.5" fill={skin.accentSoft} />
      <rect x="55" y="27" width="5" height="12" rx="2.5" fill={skin.accentSoft} />
      {/* 头 */}
      <rect x="8" y="13" width="48" height="40" rx="16" fill="#ffffff" stroke={skin.stroke} strokeWidth="2" />
      {/* 屏幕脸 */}
      <rect x="14" y="19" width="36" height="26" rx="12" fill={skin.screen} />
      {/* 眨眼眼睛 */}
      <g className="mascot-eye">
        <circle cx="26" cy="30" r="3.2" fill={skin.eye} />
        <circle cx="38" cy="30" r="3.2" fill={skin.eye} />
      </g>
      {/* 微笑 */}
      <path d="M27.5 37.5 Q32 41 36.5 37.5" stroke={skin.eye} strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* 腮红 */}
      <circle cx="18.5" cy="45" r="2.6" fill={skin.blush} opacity="0.9" />
      <circle cx="45.5" cy="45" r="2.6" fill={skin.blush} opacity="0.9" />
    </svg>
  );
}
