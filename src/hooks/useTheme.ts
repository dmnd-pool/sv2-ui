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

/**
 * Apply the saved theme's `dark` class for a surface with no theme control of its own,
 * such as the public Watcher View. It reads the preference (default light) and follows
 * the OS while that preference is `system`, but never writes it. Without this a public
 * page keeps the `dark` class index.html ships with and ignores a viewer who chose
 * light, so a watcher link opens dark even when the owner's dashboard is light.
 */
export function useAppliedTheme() {
  useEffect(() => {
    const apply = () => {
      const preference = normalizeThemePreference(localStorage.getItem('theme'));
      document.documentElement.classList.toggle('dark', resolveIsDark(preference, systemPrefersDark()));
    };
    apply();
    const mql = window.matchMedia(DARK_QUERY);
    mql.addEventListener('change', apply);
    return () => mql.removeEventListener('change', apply);
  }, []);
}
