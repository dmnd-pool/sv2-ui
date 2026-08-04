import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { BdCheckCircle } from 'solar-icon-react/bd';
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
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[8px]" onClick={finish} aria-hidden />
        <div
          role="dialog"
          aria-label="Welcome to DMND"
          className="relative flex w-full max-w-[447px] flex-col items-center gap-6 rounded-[32px] bg-background px-2 pb-8 pt-2 text-center"
        >
          <img
            src={welcomeIllustration}
            alt=""
            className="w-full rounded-3xl bg-muted"
            width={862}
            height={406}
          />
          <div className="flex flex-col gap-0.5 px-4">
            <h2 className="text-2xl font-semibold leading-9 tracking-[-1px] text-foreground">Welcome to DMND</h2>
            <p className="text-sm leading-5 text-body-alt">
              Your dashboard is ready. Learn where to monitor hashrate, track workers, view earnings, and customize your
              workspace.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={finish}
              className="rounded-[32px] border-[0.5px] border-black/20 bg-btn-secondary px-6 py-2.5 text-base leading-6 text-foreground transition-colors hover:bg-muted"
            >
              Skip for now
            </button>
            <button
              type="button"
              onClick={() => setPhase(0)}
              className="rounded-[32px] border border-black/20 bg-[hsl(var(--btn))] px-6 py-2.5 text-base leading-6 text-[hsl(var(--btn-foreground))] transition-opacity hover:opacity-90"
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
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[8px]" onClick={finish} aria-hidden />
        <div
          role="dialog"
          aria-label="You're ready to go"
          className="relative flex w-full max-w-[448px] flex-col items-center gap-3 rounded-[32px] bg-background px-6 py-10 text-center"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-toast-success p-1">
            <BdCheckCircle className="h-12 w-12 text-success" />
          </span>
          <div className="flex flex-col gap-0.5 px-6">
            <h2 className="text-2xl font-semibold leading-9 tracking-[-1px] text-foreground">
              You&apos;re ready to go.
            </h2>
            <p className="text-sm leading-5 text-body-alt">Connect a worker to begin tracking mining activity.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              markSeen();
              navigate('/account-setup');
            }}
            className="rounded-[32px] border border-black/20 bg-[hsl(var(--btn))] px-6 py-2.5 text-base leading-6 text-[hsl(var(--btn-foreground))] transition-opacity hover:opacity-90"
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
  // The rendered card measures 380px tall (every step carries the 180px preview),
  // plus the 12px side offset. Under-stating this is what let the card anchor below
  // a target with too little room, pushing its buttons off-screen.
  const CARD_STACK_SPACE = 392;
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
      <StepPreview target={step.target} />
      {/* Text and footer sit in their own 24px-inset block below the preview area. */}
      <div className="flex flex-col gap-6 px-6">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-xl font-semibold leading-8 tracking-normal text-foreground">{step.title}</h3>
          <p className="text-sm leading-5 text-body-alt">{step.body}</p>
        </div>
        <div className="flex items-center justify-between gap-6">
          <div className="flex flex-col gap-2">
            <div className="flex gap-[3px]">
              {Array.from({ length: total }, (_, i) => (
                <span key={i} className={cn('h-0.5 w-5 rounded', i <= index ? 'bg-foreground' : 'bg-secondary')} />
              ))}
            </div>
            <span className="block text-xs font-light leading-4 text-body-alt">
              Step {index + 1} of {total}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={index > 0 ? onBack : onSkip}
              className="rounded-[32px] border-[0.5px] border-black/20 bg-btn-secondary px-5 py-2 text-sm leading-5 text-foreground transition-colors hover:bg-secondary"
            >
              {index > 0 ? 'Back' : 'Skip'}
            </button>
            <button
              type="button"
              onClick={onNext}
              className="rounded-[32px] border border-black/20 bg-[hsl(var(--btn))] px-5 py-2 text-sm leading-5 text-[hsl(var(--btn-foreground))] transition-opacity hover:opacity-90"
            >
              {index === total - 1 ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
  const cardClass =
    'flex w-[447px] max-w-[calc(100vw-2rem)] flex-col gap-3 bg-muted px-2 pb-6 pt-2 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)]';

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0" onClick={onSkip} aria-hidden />
      {rect && (
        <div
          // `fixed` so the ring uses viewport coordinates directly (getBoundingClientRect
          // is viewport-relative); an `absolute` box can pick up an offset parent.
          className="pointer-events-none fixed ring-2 ring-inset ring-success"
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
          <div
            role="dialog"
            aria-label={step.title}
            className={cn('pointer-events-auto z-50 max-h-[calc(100vh-2rem)] overflow-y-auto', cardClass)}
          >
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
            // Width is capped to the viewport for narrow screens; height is capped so a
            // window too short for the whole card scrolls it internally rather than
            // hiding its footer buttons, which would strand the user mid-tour.
            className={cn('z-50 max-h-[calc(100vh-2rem)] overflow-y-auto', cardClass)}
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
/**
 * The preview panel each coach mark shows above its copy: a scaled-down, inert copy of
 * the widget being described. It clones the live element rather than shipping a static
 * asset so the preview always matches what the miner is actually looking at. The clone
 * is inert (aria-hidden, pointer-events disabled) so it never becomes a second, stale
 * set of controls.
 */
function StepPreview({ target }: { target: string }) {
  const host = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const box = host.current;
    const source = document.querySelector(`[data-tour="${target}"]`);
    if (!box || !(source instanceof HTMLElement)) return;
    const clone = source.cloneNode(true) as HTMLElement;
    clone.removeAttribute('data-tour');
    clone.setAttribute('aria-hidden', 'true');
    clone.style.width = `${source.offsetWidth}px`;
    clone.style.pointerEvents = 'none';
    // Fit the widget's width into the panel, matching the design's scaled thumbnails.
    const scale = Math.min(1, (PREVIEW_WIDTH - PREVIEW_INSET * 2) / Math.max(source.offsetWidth, 1));
    clone.style.transform = `scale(${scale})`;
    clone.style.transformOrigin = 'top left';
    box.replaceChildren(clone);
    return () => box.replaceChildren();
  }, [target]);

  return (
    <div className="h-[180px] w-full overflow-hidden bg-secondary">
      <div ref={host} aria-hidden className="pointer-events-none select-none p-4" />
    </div>
  );
}

const PREVIEW_WIDTH = 431;
const PREVIEW_INSET = 16;

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
