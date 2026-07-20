import { useEffect, useState } from 'react';
import { normalizeThemePreference, resolveIsDark, type ThemePreference } from '@/lib/theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(DARK_QUERY).matches;
}

/**
 * Theme backed by localStorage['theme'], one of light / dark / system (default
 * light). The resolved `dark` class on <html> drives the Tailwind theme; `system`
 * follows the OS and reacts to it changing. `isDark` (the resolved value) and
 * `toggle` are kept so existing consumers (the shell + auth toggle) work unchanged.
 */
export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(() =>
    typeof window === 'undefined' ? 'light' : normalizeThemePreference(localStorage.getItem('theme')),
  );
  const [prefersDark, setPrefersDark] = useState<boolean>(systemPrefersDark);

  // Track the OS setting only so a `system` preference re-resolves when it flips.
  useEffect(() => {
    const mql = window.matchMedia(DARK_QUERY);
    const onChange = () => setPrefersDark(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  const isDark = resolveIsDark(preference, prefersDark);

  useEffect(() => {
    window.document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', preference);
  }, [isDark, preference]);

  return {
    isDark,
    preference,
    setTheme: setPreference,
    // Explicit flip between light and dark (never lands on `system`).
    toggle: () => setPreference((p) => (resolveIsDark(p, prefersDark) ? 'light' : 'dark')),
  };
}
