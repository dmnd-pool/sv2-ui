import { LiMoon, LiSun } from 'solar-icon-react/li';
import { useTheme } from '@/hooks/useTheme';

/** Sun/moon theme toggle: a filled, bordered circle. */
export function ThemeToggle() {
  const { toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle theme"
      className="relative flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-muted text-foreground transition-colors hover:text-foreground"
    >
      <LiSun className="absolute h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <LiMoon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </button>
  );
}
