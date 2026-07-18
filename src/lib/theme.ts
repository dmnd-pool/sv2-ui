/** The theme the user picks: an explicit mode, or follow the operating system. */
export type ThemePreference = 'light' | 'dark' | 'system';

/** Whether the dark theme should apply, given the preference and the OS setting. */
export function resolveIsDark(preference: ThemePreference, systemPrefersDark: boolean): boolean {
  if (preference === 'system') return systemPrefersDark;
  return preference === 'dark';
}

/** Read a stored preference, defaulting to light for absent or unrecognised values. */
export function normalizeThemePreference(stored: string | null | undefined): ThemePreference {
  return stored === 'dark' || stored === 'system' ? stored : 'light';
}
