import { OTPInput, type SlotProps } from 'input-otp';
import { cn } from '@/lib/utils';

interface OtpFieldProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
  /** Renders the boxes in the red error state, per the 2FA error screen. */
  error?: boolean;
}

/**
 * Six-box one-time-code input for the 2FA step, built on input-otp. The library
 * keeps a single hidden input; we just render the visible boxes.
 */
export function OtpField({ value, onChange, onComplete, disabled, ariaLabel, error }: OtpFieldProps) {
  return (
    <OTPInput
      maxLength={6}
      value={value}
      onChange={onChange}
      onComplete={onComplete}
      disabled={disabled}
      aria-label={ariaLabel ?? 'Verification code'}
      containerClassName="w-full"
      render={({ slots }) => (
        <div className="flex w-full items-center gap-2">
          {slots.map((slot, i) => (
            <OtpSlot key={i} error={error} {...slot} />
          ))}
        </div>
      )}
    />
  );
}

function OtpSlot({ isActive, char, hasFakeCaret, error }: SlotProps & { error?: boolean }) {
  return (
    <div
      className={cn(
        'relative flex h-12 flex-1 items-center justify-center rounded-[12px] border bg-muted text-lg font-medium tabular-nums transition-all',
        error ? 'border-destructive text-destructive' : 'border-border',
        isActive &&
          (error
            ? 'z-10 ring-2 ring-destructive ring-offset-2 ring-offset-background'
            : 'z-10 ring-2 ring-ring ring-offset-2 ring-offset-background'),
      )}
    >
      {char}
      {hasFakeCaret && (
        <span className="pointer-events-none absolute h-5 w-px animate-pulse bg-foreground" />
      )}
    </div>
  );
}
