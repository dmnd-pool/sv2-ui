import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { LiAltArrowLeft } from 'solar-icon-react/li';
import { ThemeToggle } from '@/components/auth/ThemeToggle';
import { cn } from '@/lib/utils';

export type OnboardingStep = 'twofa' | 'bitcoin' | 'connect' | 'done';

type GateStep = Exclude<OnboardingStep, 'done'>;
const STEP_ORDER: GateStep[] = ['twofa', 'bitcoin', 'connect'];

const STEPS: { key: GateStep; label: string; sub: string }[] = [
  { key: 'twofa', label: 'Setup 2FA', sub: 'Two-factor authentication protects your account' },
  { key: 'bitcoin', label: 'Bitcoin address', sub: 'Add a Bitcoin address to receive mining rewards.' },
  { key: 'connect', label: 'Connect workers', sub: 'Point your mining hardware at the pool.' },
];

type NodeState = 'done' | 'active' | 'future';

/** Steps before the current one are done, the current is active, later ones future. */
function stateFor(stepKey: GateStep, current: OnboardingStep): NodeState {
  if (current === 'done') return 'done';
  const here = STEP_ORDER.indexOf(stepKey);
  const at = STEP_ORDER.indexOf(current);
  if (here === at) return 'active';
  return here < at ? 'done' : 'future';
}

function StepCircle({ state }: { state: NodeState }) {
  if (state === 'done') {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success">
        <Check className="h-3.5 w-3.5 text-white" />
      </span>
    );
  }
  return (
    <span
      className={cn(
        'h-6 w-6 shrink-0 rounded-full border-2',
        state === 'active' ? 'border-foreground' : 'border-border',
      )}
    />
  );
}

/** Vertical rail (desktop) / horizontal row (mobile) of the two account steps. */
function Stepper({ current, orientation }: { current: OnboardingStep; orientation: 'vertical' | 'horizontal' }) {
  if (orientation === 'horizontal') {
    // Three full labels don't fit at 375px, so mobile shows the connected
    // circles plus only the active step's label (the content heading repeats it).
    const activeLabel = STEPS.find((step) => stateFor(step.key, current) === 'active')?.label;
    return (
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {STEPS.map((step, i) => (
            <div key={step.key} className="flex flex-1 items-center gap-2">
              <StepCircle state={stateFor(step.key, current)} />
              {i < STEPS.length - 1 && <span className="h-px flex-1 border-t border-dashed border-border" />}
            </div>
          ))}
        </div>
        {activeLabel && <p className="mt-2 text-sm font-medium text-foreground">{activeLabel}</p>}
      </div>
    );
  }

  return (
    <div>
      {STEPS.map((step, i) => {
        const state = stateFor(step.key, current);
        return (
          <div key={step.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <StepCircle state={state} />
              {i < STEPS.length - 1 && <span className="my-1 h-8 w-px border-l border-dashed border-border" />}
            </div>
            <div className="pb-6">
              <p className={cn('text-sm', state === 'active' || state === 'done' ? 'font-medium text-foreground' : 'text-body-alt')}>
                {step.label}
              </p>
              <p className="mt-0.5 text-xs text-body-alt">{step.sub}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * The two-column "Complete account" shell: a stepper rail on the left and the
 * active step's content on the right. On mobile the rail collapses to a
 * horizontal stepper above the content. Scoped under `.dmnd-auth` so it reuses
 * the auth design tokens and the focus-border rule the shared inputs depend on.
 */
export function OnboardingLayout({
  current,
  onBack,
  children,
}: {
  current: OnboardingStep;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <div className="dmnd-auth flex h-screen w-full overflow-hidden bg-background p-0 text-foreground lg:bg-canvas lg:p-2">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row lg:gap-2">
        {/* Left rail */}
        <div className="relative flex w-full flex-col overflow-hidden bg-background lg:w-[34%]">
          <div className="flex items-center justify-between px-6 py-6 lg:px-12 lg:py-8">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1 text-sm text-foreground transition-colors hover:opacity-80"
            >
              <LiAltArrowLeft className="h-4 w-4" />
              Back
            </button>
            <ThemeToggle />
          </div>

          {/* Desktop vertical rail */}
          <div className="hidden flex-1 px-12 lg:block">
            <h2 className="text-xl font-semibold text-heading">Complete account</h2>
            <p className="mb-6 mt-1 text-sm text-body-alt">Finish your account setup</p>
            <div className="h-px w-full bg-border" />
            <div className="mt-6">
              <Stepper current={current} orientation="vertical" />
            </div>
          </div>

          {/* Mobile horizontal stepper */}
          <div className="px-6 pb-2 lg:hidden">
            <Stepper current={current} orientation="horizontal" />
          </div>
        </div>

        {/* Right content */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-background px-6 py-6 lg:px-16 lg:py-16">
          <div className="mx-auto w-full max-w-[600px]">{children}</div>
        </div>
      </div>
    </div>
  );
}
