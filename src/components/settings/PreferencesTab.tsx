import { Check } from 'lucide-react';
import { LiGlobal, LiAltArrowDown } from 'solar-icon-react/li';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';
import type { ThemePreference } from '@/lib/theme';

/** A small stylised window preview for each theme option. */
function ThemePreview({ variant }: { variant: ThemePreference }) {
  // Light and dark render a fixed palette; system splits to hint "follows the OS".
  const surface =
    variant === 'light' ? 'bg-neutral-100' : variant === 'dark' ? 'bg-neutral-900' : 'bg-gradient-to-r from-neutral-100 to-neutral-900';
  const bar = variant === 'dark' ? 'bg-neutral-700' : variant === 'light' ? 'bg-neutral-300' : 'bg-neutral-500';
  return (
    <div className={cn('flex h-16 w-full flex-col gap-1.5 rounded-lg p-2.5', surface)}>
      <span className={cn('h-1.5 w-8 rounded-full', bar)} />
      <span className={cn('h-1.5 w-12 rounded-full', bar)} />
      <span className={cn('mt-auto h-3 w-full rounded', bar)} />
    </div>
  );
}

function ThemeCard({
  variant,
  label,
  selected,
  onSelect,
}: {
  variant: ThemePreference;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className="flex flex-col items-center gap-2"
    >
      <div
        className={cn(
          'relative w-full rounded-xl border p-1 transition-colors',
          selected ? 'border-[hsl(var(--btn))]' : 'border-border hover:border-foreground/30',
        )}
      >
        <ThemePreview variant={variant} />
        {selected && (
          <span className="absolute -bottom-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[hsl(var(--btn))] ring-2 ring-card">
            <Check className="h-3 w-3 text-[hsl(var(--btn-foreground))]" strokeWidth={3} />
          </span>
        )}
      </div>
      <span className={cn('text-xs', selected ? 'font-medium text-foreground' : 'text-body-alt')}>{label}</span>
    </button>
  );
}

const THEMES: { variant: ThemePreference; label: string }[] = [
  { variant: 'light', label: 'Light' },
  { variant: 'dark', label: 'Dark' },
  { variant: 'system', label: 'System' },
];

/**
 * The Preferences tab: the dashboard theme (light / dark / system, persisted locally)
 * and the display language. The language is shown read-only: the account language is
 * fixed server-side with no update endpoint, so the copy states what the language IS
 * rather than inviting a choice the user cannot make.
 */
export function PreferencesTab() {
  const { preference, setTheme } = useTheme();

  return (
    <div className="max-w-2xl space-y-10">
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-heading">Theme</h2>
          <p className="mt-1 text-sm text-body-alt">Choose the theme of your dashboard</p>
        </div>
        <div className="h-px w-full bg-border" />
        <div className="grid max-w-md grid-cols-3 gap-4">
          {THEMES.map((t) => (
            <ThemeCard
              key={t.variant}
              variant={t.variant}
              label={t.label}
              selected={preference === t.variant}
              onSelect={() => setTheme(t.variant)}
            />
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-heading">Localization</h2>
          {/* States the language rather than offering a choice: the account language is
              set server-side and there is no endpoint to change it. */}
          <p className="mt-1 text-sm text-body-alt">The language used across your dashboard</p>
        </div>
        <div className="h-px w-full bg-border" />
        <div className="space-y-1.5">
          <span className="text-sm text-body-alt">Display language</span>
          <div
            className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-muted px-4 py-2.5 text-sm text-foreground"
            aria-disabled
          >
            <span className="flex items-center gap-2">
              <LiGlobal className="h-4 w-4 text-body-alt" />
              English
            </span>
            <LiAltArrowDown className="h-4 w-4 text-placeholder" />
          </div>
        </div>
      </div>
    </div>
  );
}
