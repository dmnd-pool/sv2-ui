import { useEffect, useState } from 'react';

/**
 * Light/dark theme backed by localStorage['theme'], defaulting to light.
 * Toggling flips the `dark` class on <html>, which drives the Tailwind theme.
 * Shared by the app shell and the pre-auth screens so the toggle behaves the
 * same everywhere.
 */
export function useTheme() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem('theme');
    // Light-first default; a saved preference still wins.
    return saved ? saved === 'dark' : false;
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  return { isDark, toggle: () => setIsDark((v) => !v) };
}
