import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * A square check control for table rows (row select + header select-all), shared by
 * the workers and subaccounts tables so the two leading columns cannot drift apart.
 * Mirrors the customize panel's checkbox.
 */
export function CellCheckbox({
  checked,
  indeterminate = false,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  label: string;
}) {
  const active = checked || indeterminate;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-label={label}
      onClick={onChange}
      className={cn(
        'mx-auto flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border transition-colors',
        active ? 'border-transparent bg-[hsl(var(--btn))]' : 'border-border hover:border-foreground',
      )}
    >
      {indeterminate ? (
        <Minus className="h-3 w-3 text-[hsl(var(--btn-foreground))]" strokeWidth={3} />
      ) : checked ? (
        <Check className="h-3 w-3 text-[hsl(var(--btn-foreground))]" strokeWidth={3} />
      ) : null}
    </button>
  );
}
