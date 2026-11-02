import { useThemeStore } from '../../store/theme';
import { SunIcon, MoonIcon } from '../icons';
import { IconButton } from './IconButton';

export function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  const isDark = theme === 'dark';
  return (
    <IconButton
      label={isDark ? '切换到浅色模式' : '切换到暗色模式'}
      size="md"
      onClick={toggle}
    >
      {isDark ? <SunIcon size={18} /> : <MoonIcon size={18} />}
    </IconButton>
  );
}
