import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SignupStep = 'details' | 'security';

type StepState = 'done' | 'active' | 'future';

/**
 * Two-step progress indicator above the signup form (Personal info -> Security),
 * matching the designer's frames: a 20px circle + 14px label per step joined by
 * a dashed rule. Active = dark ring + dark medium label, done = filled circle
 * with a check, future = grey ring + grey label. Token-driven, so it inverts in
 * dark mode like the rest of the auth screens.
 */
export function SignupStepper({ current }: { current: SignupStep }) {
  const personal: StepState = current === 'security' ? 'done' : 'active';
  const security: StepState = current === 'security' ? 'active' : 'future';

  return (
    <div className="flex items-center gap-3">
      <Step label="Personal info" state={personal} />
      <span className="h-px flex-1 border-t border-dashed border-border" />
      <Step label="Security" state={security} />
    </div>
  );
}

function Step({ label, state }: { label: string; state: StepState }) {
  return (
    <div className="flex items-center gap-2">
      <StepDot state={state} />
      <span
        className={cn(
          'whitespace-nowrap text-sm',
          state === 'active' ? 'font-medium text-foreground' : 'text-placeholder',
        )}
      >
        {label}
      </span>
    </div>
  );
}

function StepDot({ state }: { state: StepState }) {
  if (state === 'done') {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background">
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
    );
  }
  return (
    <span
      className={cn(
        'h-5 w-5 rounded-full border',
        state === 'active' ? 'border-foreground' : 'border-placeholder',
      )}
    />
  );
}
