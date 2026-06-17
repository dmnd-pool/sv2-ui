import { useEffect, useState } from 'react';
import {
  preloadPasswordStrength,
  quickStrength,
  scoreStrength,
  type PasswordStrength,
  type PasswordStrengthLevel,
} from '@/auth/passwordStrength';
import { cn } from '@/lib/utils';

// How many of the three segments are filled, and in what colour, per level.
const SEGMENTS: Record<PasswordStrengthLevel, { filled: number; color: string }> = {
  empty: { filled: 0, color: '' },
  weak: { filled: 1, color: 'bg-destructive' },
  medium: { filled: 2, color: 'bg-warning' },
  strong: { filled: 3, color: 'bg-success' },
};
const TEXT: Record<PasswordStrengthLevel, string> = {
  empty: 'text-destructive',
  weak: 'text-destructive',
  medium: 'text-warning',
  strong: 'text-success',
};

interface PasswordStrengthMeterProps {
  password: string;
  show: boolean;
  /**
   * A server-side rejection (e.g. weak password) to show instead of the local
   * read, so the meter stays the single source of password feedback rather than
   * contradicting itself with a separate inline message.
   */
  errorOverride?: string | null;
}

/**
 * Scores the password with zxcvbn (lazy-loaded), debounced. Until the engine
 * loads, a synchronous read shows instantly but never claims 'strong', so the
 * bar never flashes a false green.
 */
function usePasswordStrength(password: string, enabled: boolean): PasswordStrength {
  const [result, setResult] = useState<PasswordStrength>(() => quickStrength(password));

  // Warm the zxcvbn chunk once the meter is shown so the first real score lands
  // quickly instead of after a visible chunk-download delay.
  useEffect(() => {
    if (enabled) preloadPasswordStrength();
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    // Clearing the field resets instantly.
    if (password === '') {
      setResult(quickStrength(''));
      return;
    }
    // Hold the last settled colour while the user is typing and only update once
    // they pause. This avoids the per-keystroke flip where an instant placeholder
    // (capped at yellow) flashed before zxcvbn upgraded it to green.
    let cancelled = false;
    const id = setTimeout(() => {
      void scoreStrength(password).then((r) => {
        if (!cancelled) setResult(r);
      });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [password, enabled]);

  return result;
}

/**
 * Strength meter under the signup password field: a
 * 3-segment bar (1 red weak / 2 yellow medium / 3 green strong) plus helper
 * text, with a 9-char-minimum prompt when empty. Shown once the field is
 * focused or has input.
 */
export function PasswordStrengthMeter({ password, show, errorOverride }: PasswordStrengthMeterProps) {
  const live = usePasswordStrength(password, show);
  if (!show && !errorOverride) return null;

  const level: PasswordStrengthLevel = errorOverride ? 'weak' : live.level;
  const message = errorOverride ?? live.message;
  const { filled, color } = SEGMENTS[level];

  return (
    <div className="space-y-1.5 pt-1">
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className={cn('h-1 flex-1 rounded-full', i < filled ? color : 'bg-muted')} />
        ))}
      </div>
      <p className={cn('text-xs', TEXT[level])}>{message}</p>
    </div>
  );
}
