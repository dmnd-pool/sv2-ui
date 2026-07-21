import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { Check } from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';
import { cn, overlayContainer } from '@/lib/utils';
import welcomeIllustration from '@/assets/tour-welcome.png';

// The guided tour: a welcome modal, then five coach-mark steps anchored to real home
// sections (matched by data-tour attributes), then a completion. Copy is taken from
// the design's tour frames. A finished/skipped tour is remembered per browser.
const SEEN_KEY = 'dmnd.tour.seen';

interface Step {
  target: string; // data-tour value of the element to highlight
  title: string;
  body: string;
  // Where the coach-mark sits relative to its target (from the design); Radix still
  // flips it if that side would go off-screen.
  side: 'top' | 'right' | 'bottom' | 'left';
  align: 'start' | 'center' | 'end';
}

const STEPS: Step[] = [
  {
    target: 'hashrate',
    title: 'Your Live Hashrate',
    body: 'Monitor your live hashrate in real time as workers begin submitting shares. Updates automatically to help you track mining performance.',
    side: 'right',
    align: 'end',
  },
  {
    target: 'stats-workers',
    title: 'Workers',
    body: 'Monitor worker activity, track offline miners, and identify issues before they impact earnings.',
    side: 'right',
    align: 'end',
  },
  {
    target: 'stats-earnings',
    title: 'Earnings & Performance',
    body: 'Track daily earnings, worker health, and mining performance across your entire operation.',
    side: 'left',
    align: 'start',
  },
  {
    // The chart spans the full width, so left/right can't fit the card; place it
    // above the chart (top) where there is always room.
    target: 'performance',
    title: 'Mining Performance',
    body: 'Once workers begin mining, performance charts help you understand trends and identify changes over time.',
    side: 'top',
    align: 'start',
  },
  {
    target: 'customize',
    title: 'Customize Dashboard',
    body: 'Rearrange widgets and choose what information appears on your dashboard. Make DMND work the way you prefer.',
    side: 'bottom',
    align: 'end',
  },
];

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* ignore */
  }
}

/** True when the user has already seen (finished or skipped) the tour. */
export function hasSeenTour(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

type Phase = 'welcome' | number | 'done';

export function ProductTour({ onClose }: { onClose: () => void }) {
  const [, navigate] = useLocation();
  const [phase, setPhase] = useState<Phase>('welcome');

  // Only walk steps whose target is actually on the page. Customizing the dashboard can
  // hide a widget (e.g. the worker stats), and a step pointing at a missing element would
  // otherwise float in the middle of the screen highlighting nothing. Computed once when
  // the tour opens; the layout doesn't change while the tour is running. The Customize
  // button always exists, so there is always at least one step.
  const steps = useMemo(() => {
    const present = STEPS.filter((s) => document.querySelector(`[data-tour="${s.target}"]`));
    return present.length > 0 ? present : STEPS;
  }, []);

  const finish = () => {
    markSeen();
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === 'welcome') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50" onClick={finish} aria-hidden />
        <div
          role="dialog"
          aria-label="Welcome to DMND"
          className="relative w-full max-w-md rounded-3xl border border-border bg-popover p-6 text-center shadow-2xl"
        >
          <img
            src={welcomeIllustration}
            alt=""
            className="mb-5 w-full rounded-2xl"
            width={862}
            height={406}
          />
          <h2 className="text-xl font-semibold text-heading">Welcome to DMND</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-body-alt">
            Your dashboard is ready. Learn where to monitor hashrate, track workers, view earnings, and customize your
            workspace.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={finish}
              className="rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Skip for now
            </button>
            <button
              type="button"
              onClick={() => setPhase(0)}
              className="rounded-full bg-[hsl(var(--btn))] px-5 py-2.5 text-sm font-medium text-[hsl(var(--btn-foreground))] transition-opacity hover:opacity-90"
            >
              Take a tour
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50" onClick={finish} aria-hidden />
        <div
          role="dialog"
          aria-label="You're ready to go"
          className="relative w-full max-w-sm rounded-3xl border border-border bg-popover p-8 text-center shadow-2xl"
        >
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/15">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-success">
              <Check className="h-5 w-5 text-white" strokeWidth={3} />
            </span>
          </span>
          <h2 className="text-xl font-semibold text-heading">You&apos;re ready to go.</h2>
          <p className="mx-auto mt-2 max-w-xs text-sm text-body-alt">
            Connect a worker to begin tracking mining activity.
          </p>
          <button
            type="button"
            onClick={() => {
              markSeen();
              navigate('/account-setup');
            }}
            className="mt-6 w-full rounded-full bg-[hsl(var(--btn))] px-5 py-2.5 text-sm font-medium text-[hsl(var(--btn-foreground))] transition-opacity hover:opacity-90"
          >
            Start mining
          </button>
        </div>
      </div>
    );
  }

  // Clamp in case the active-step count is smaller than a stale phase index.
  const index = Math.min(phase, steps.length - 1);
  return (
    <CoachMark
      step={steps[index]}
      index={index}
      total={steps.length}
      onBack={() => setPhase(index - 1)}
      onNext={() => (index === steps.length - 1 ? setPhase('done') : setPhase(index + 1))}
      onSkip={finish}
    />
  );
}

/**
 * A single coach-mark: a green ring over the target's union rect, and a card anchored
 * to it. Radix Popover positions the card (side/align + collision flipping), so there
 * is no hand-rolled placement math to drift; the anchor is a zero-size element pinned
 * to the target rect.
 */
function CoachMark({
  step,
  index,
  total,
  onBack,
  onNext,
  onSkip,
}: {
  step: Step;
  index: number;
  total: number;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const rect = useTargetRect(step.target);

  // A left/right card needs ~460px of clear space beside the target (card + offset +
  // padding). A full-width widget (every widget below the lg breakpoint, and the chart
  // at any width) leaves no room on either side, so the card would be pushed off-screen.
  // When neither side fits, drop the card below the target instead; Radix still flips it
  // above if the target sits near the bottom.
  const CARD_SIDE_SPACE = 460;
  const CARD_STACK_SPACE = 210; // card height plus the side offset
  const wantsHorizontal = step.side === 'left' || step.side === 'right';
  const noSideRoom =
    wantsHorizontal &&
    rect != null &&
    window.innerWidth - rect.left - rect.width < CARD_SIDE_SPACE &&
    rect.left < CARD_SIDE_SPACE;
  const side = noSideRoom ? 'bottom' : step.side;
  const align = noSideRoom ? 'center' : step.align;

  // On a short window a tall widget can leave too little room both above and below, so
  // the anchored card would hang off an edge. It then floats free instead, pinned to
  // whichever gap is larger so it still never covers the widget the step describes.
  const spaceAbove = rect ? rect.top : 0;
  const spaceBelow = rect ? window.innerHeight - (rect.top + rect.height) : 0;
  const floating = rect != null && spaceAbove < CARD_STACK_SPACE && spaceBelow < CARD_STACK_SPACE;
  const floatAtBottom = spaceBelow >= spaceAbove;

  // The card's contents, shared by the anchored and the floating placement.
  const cardBody = (
    <>
      <h3 className="text-xl font-semibold text-heading">{step.title}</h3>
      <p className="mt-1.5 text-sm text-body-alt">{step.body}</p>
      <div className="mt-5 flex items-center justify-between gap-4">
        <div>
          <div className="flex gap-[3px]">
            {Array.from({ length: total }, (_, i) => (
              <span key={i} className={cn('h-0.5 w-5 rounded-full', i <= index ? 'bg-foreground' : 'bg-secondary')} />
            ))}
          </div>
          <span className="mt-1.5 block text-xs font-light text-body-alt">
            Step {index + 1} of {total}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={index > 0 ? onBack : onSkip}
            className="rounded-full border border-border bg-muted px-5 py-2 text-sm text-foreground transition-colors hover:bg-secondary"
          >
            {index > 0 ? 'Back' : 'Skip'}
          </button>
          <button
            type="button"
            onClick={onNext}
            className="rounded-full bg-[hsl(var(--btn))] px-5 py-2 text-sm text-[hsl(var(--btn-foreground))] transition-opacity hover:opacity-90"
          >
            {index === total - 1 ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </>
  );
  const cardClass =
    'flex w-[431px] max-w-[calc(100vw-2rem)] flex-col rounded-2xl border border-border bg-popover p-6 shadow-2xl';

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onSkip} aria-hidden />
      {rect && (
        <div
          // `fixed` so the ring uses viewport coordinates directly (getBoundingClientRect
          // is viewport-relative); an `absolute` box can pick up an offset parent.
          className="pointer-events-none fixed rounded-xl ring-2 ring-success ring-offset-2 ring-offset-background"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
          aria-hidden
        />
      )}
      {floating ? (
        <div
          className={cn(
            'pointer-events-none fixed inset-x-0 flex justify-center px-4',
            // Sit in the roomier gap so the highlighted widget stays readable.
            floatAtBottom ? 'bottom-4' : 'top-4',
          )}
        >
          <div role="dialog" aria-label={step.title} className={cn('pointer-events-auto z-50', cardClass)}>
            {cardBody}
          </div>
        </div>
      ) : (
      <Popover.Root open>
        {/* Anchor pinned to the VISIBLE part of the target rect. The ring still traces the
            whole element, but a target taller than the viewport (a big chart on a short
            window) would otherwise leave Radix no in-view edge to attach to, and the card
            would be pushed off-screen. Clamping keeps the anchor on screen so the card
            always lands beside something visible. */}
        <Popover.Anchor asChild>
          <div
            className="pointer-events-none fixed"
            style={rect ? visibleAnchorStyle(rect) : { top: '50%', left: '50%' }}
            aria-hidden
          />
        </Popover.Anchor>
        {/* Portal into the themed shell, not document.body, so the card keeps the DMND
            design tokens and heading font (both scoped to .dmnd-app); on the body the
            title fell back to Inter and the dark Next button lost its background. */}
        <Popover.Portal container={overlayContainer()}>
          <Popover.Content
            side={side}
            align={align}
            sideOffset={12}
            collisionPadding={16}
            avoidCollisions
            // On a very short viewport neither side has room, so let Radix slide the card
            // back inside the viewport (overlapping the target) rather than letting it
            // hang off the edge. Sticking to the target is preferable to clipping.
            sticky="always"
            hideWhenDetached={false}
            onOpenAutoFocus={(e) => e.preventDefault()}
            aria-label={step.title}
            // No internal scrolling: the card is short, and it falls back to a centred
            // overlay when no side has room, so a scrollbar inside the card would only
            // ever look like a glitch. Width is capped to the viewport for narrow screens.
            className={cn('z-50', cardClass)}
          >
            {cardBody}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      )}
    </div>
  );
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
}

/**
 * The part of a target rect that is actually inside the viewport, as fixed-position
 * styles for the popover anchor. A target taller (or wider) than the window leaves Radix
 * without an on-screen edge to position against, which pushes the card out of view; this
 * keeps at least a sliver of anchor visible, with a small inset so a card placed beside
 * it still clears the window edge.
 */
function visibleAnchorStyle(rect: Box): { top: number; left: number; width: number; height: number } {
  const pad = 8;
  const top = Math.min(Math.max(rect.top, pad), Math.max(window.innerHeight - pad, pad));
  const bottom = Math.max(Math.min(rect.top + rect.height, window.innerHeight - pad), top);
  const left = Math.min(Math.max(rect.left, pad), Math.max(window.innerWidth - pad, pad));
  const right = Math.max(Math.min(rect.left + rect.width, window.innerWidth - pad), left);
  return { top, left, width: right - left, height: bottom - top };
}

/** The union rect of the space between elements' bounding boxes. */
function unionRect(els: Element[]): Box | null {
  if (els.length === 0) return null;
  let top = Infinity;
  let left = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const el of els) {
    const r = el.getBoundingClientRect();
    top = Math.min(top, r.top);
    left = Math.min(left, r.left);
    right = Math.max(right, r.right);
    bottom = Math.max(bottom, r.bottom);
  }
  return { top, left, width: right - left, height: bottom - top, bottom };
}

/**
 * The on-screen box wrapping every element tagged data-tour={target}. A step can
 * highlight a group of cards (e.g. the two worker stat cards) by tagging them all
 * with the same value; the ring wraps their union. Tracked on resize and scroll.
 */
function useTargetRect(target: string) {
  const selector = useMemo(() => `[data-tour="${target}"]`, [target]);
  const [rect, setRect] = useState<Box | null>(null);
  useEffect(() => {
    const els = () => Array.from(document.querySelectorAll(selector));
    const measure = () => setRect(unionRect(els()));
    // Measure IMMEDIATELY so the ring and card appear together with no lag, bring the
    // target into view, then keep the position in sync as the scroll settles and on
    // resize/scroll (the `scroll` listener re-measures every frame of the scroll).
    measure();
    // Align to the top rather than centring: centring splits the leftover space into two
    // gaps that are each too small for the coach mark on a short window, which forces it
    // to overlap the very widget it is describing. Starting at the top pools the free
    // space below the target, so the card has somewhere to sit.
    els()[0]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [selector]);
  return rect;
}
