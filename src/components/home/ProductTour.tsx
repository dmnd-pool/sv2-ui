import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { BdCheckCircle } from 'solar-icon-react/bd';
import * as Popover from '@radix-ui/react-popover';
import { cn, overlayContainer } from '@/lib/utils';
import { clearTourProgress, readTourProgress, resumeTourIndex, saveTourProgress } from '@/lib/tourProgress';
import { NAV_GROUPS, SETTINGS_ITEM, type NavItem } from '@/components/dashboard/nav';
import { NavigationTourContext } from '@/components/dashboard/DashboardShell';
import welcomeIllustration from '@/assets/tour-welcome.png';

// Walk through home widgets and available navigation, then remember completion per browser.
const SEEN_KEY = 'dmnd.tour.seen';

interface Step {
  target: string; // data-tour value of the element to highlight
  section?: 'Navigation' | 'Account controls';
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
    body: 'Shows live hashrate of your miners for this account. It is updated every 5 minutes. A drop can mean fewer workers are mining or a miner needs attention.',
    side: 'right',
    align: 'end',
  },
  {
    target: 'stats-workers',
    title: 'Workers',
    body: 'Workers are your connected miners/devices. A worker is considered active if it has sent mining data in the last 10 minutes; the total includes all workers seen in the last 24 hours. Average hashrate shows the mining power per active worker.',
    side: 'right',
    align: 'end',
  },
  {
    target: 'stats-earnings',
    title: 'Generated BTC & Latest Payout',
    body: 'Today’s Generated BTC is the Bitcoin you have earned through FPPS, since midnight UTC of the current day. Latest payout is the most recent confirmed payment to your wallet in the last 30 days.',
    side: 'left',
    align: 'start',
  },
  {
    target: 'stats-rejection',
    title: 'Rejection Rate',
    body: 'Percentage of shares rejected by the pool in the last 24 hours. Lower is better. If it rises, check your miners and their connection.',
    side: 'left',
    align: 'end',
  },
  {
    // The chart spans the full width, so left/right can't fit the card; place it
    // above the chart (top) where there is always room.
    target: 'performance',
    title: 'Mining Performance',
    body: 'See how your mining performance changes over time. Choose a time range to spot drops or compare recent activity. The FPPS and PPLNS lines show mining power for the two reward methods.',
    side: 'top',
    align: 'start',
  },
  {
    target: 'customize',
    title: 'Customize Dashboard',
    body: 'Choose which cards and charts appear on your dashboard, then drag them into the order you prefer. Your layout is saved in this browser.',
    side: 'bottom',
    align: 'end',
  },
];

const ACCOUNT_STEPS: Step[] = [
  {
    target: 'account-switcher',
    title: 'Switch Accounts',
    body: 'Use this menu to choose which account you want to see. Select a subaccount to view only its miners and earnings. The name here shows your current account.',
    section: 'Account controls',
    side: 'right',
    align: 'start',
  },
  {
    target: 'aggregated-dashboard',
    title: 'Aggregated Dashboard',
    body: 'Turn this on to see the aggregated  workers, hashrate, and earnings of your main account and all subaccounts. Turn it off to see your main account alone. To see one subaccount, choose it in the account menu.',
    section: 'Account controls',
    side: 'bottom',
    align: 'end',
  },
];

/** Include only routes rendered for this account, even when the mobile drawer is closed. */
function navigationSteps(): Step[] {
  const describe = (item: NavItem): Step => ({
    target: `nav:${item.href}`,
    title: item.image ? 'Trust Center' : item.label === 'BUILD YOUR BLOCK' ? 'Build Your Block' : item.label,
    body: item.tourDescription,
    section: 'Navigation',
    side: 'right',
    align: 'start',
  });
  const items = [...NAV_GROUPS.flatMap((group) => group.items), SETTINGS_ITEM];
  const steps = items
    .filter((item) => item.href !== '/home' && document.querySelector(`[data-tour="nav:${item.href}"]`))
    .map(describe);
  if (document.querySelector('[data-tour="nav:/help"]')) {
    steps.push({
      target: 'nav:/help',
      title: 'Help & Support',
      body: 'Find answers about mining, rewards, and account setup. Browse common questions, follow setup guides, or contact the DMND team for help',
      section: 'Navigation',
      side: 'bottom',
      align: 'end',
    });
  }
  return steps;
}

function availableSteps(): Step[] {
  return [
    ...STEPS.filter((step) => document.querySelector(`[data-tour="${step.target}"]`)),
    ...ACCOUNT_STEPS.filter((step) => document.querySelector(`[data-tour="${step.target}"]`)),
    ...navigationSteps(),
  ];
}

/** Hidden desktop navigation and the off-screen mobile drawer must not create a union ring. */
function visibleTargets(target: string): Element[] {
  return Array.from(document.querySelectorAll(`[data-tour="${target}"]`)).filter((el) => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.left < window.innerWidth;
  });
}

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
  const [phase, setPhase] = useState<Phase>('welcome');
  const [savedProgress] = useState(readTourProgress);

  const [steps, setSteps] = useState<Step[]>([]);
  const { setNavigationTourOpen } = useContext(NavigationTourContext);
  const activeStep = typeof phase === 'number' ? steps[phase] : undefined;
  const needsDrawer = !!activeStep?.section && activeStep.target !== 'nav:/help';

  useEffect(() => {
    if (!needsDrawer) return;
    setNavigationTourOpen(true);
    return () => setNavigationTourOpen(false);
  }, [needsDrawer, setNavigationTourOpen]);

  // Discover targets after commit and keep the welcome screen current while
  // permissions, reports, and widgets load. Freeze the order once the tour starts.
  useEffect(() => {
    if (phase !== 'welcome') return;
    const updateSteps = () => {
      const next = availableSteps();
      setSteps((previous) => previous.length === next.length &&
        previous.every((step, index) => step.target === next[index].target) ? previous : next);
    };
    updateSteps();
    const observer = new MutationObserver(updateSteps);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-tour'] });
    return () => observer.disconnect();
  }, [phase]);

  const targets = useMemo(() => steps.map((step) => step.target), [steps]);
  const resumeIndex = resumeTourIndex(savedProgress, targets);

  // Save on every step, including Back, so Skip, Escape, and a page reload all resume here.
  useEffect(() => {
    if (typeof phase === 'number' && steps[phase]) {
      saveTourProgress(steps[phase].target, targets);
    } else if (phase === 'done') {
      clearTourProgress();
      markSeen();
    }
  }, [phase, steps, targets]);

  const finish = useCallback(() => {
    markSeen();
    onClose();
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [finish]);

  if (phase === 'welcome') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[8px]" onClick={finish} aria-hidden />
        <div
          role="dialog"
          aria-label={resumeIndex !== null ? 'Continue your tour' : 'Welcome to DMND'}
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
            <h2 className="text-2xl font-semibold leading-9 tracking-[-1px] text-foreground">
              {resumeIndex !== null ? 'Continue your tour' : 'Welcome to DMND'}
            </h2>
            <p className="text-sm leading-5 text-body-alt">
              {resumeIndex !== null
                ? `Pick up at “${steps[resumeIndex].title}” or start again. You can skip anytime; your place is saved in this browser.`
                : 'Learn how to check your miners, understand your earnings, and find your way around. You can skip anytime and continue later in this browser.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 px-4">
            <button
              type="button"
              onClick={finish}
              className="rounded-[32px] border-[0.5px] border-black/20 bg-btn-secondary px-6 py-2.5 text-base leading-6 text-foreground transition-colors hover:bg-muted"
            >
              Skip for now
            </button>
            <button
              type="button"
              onClick={() => setPhase(steps.length ? resumeIndex ?? 0 : 'done')}
              className="rounded-[32px] border border-black/20 bg-[hsl(var(--btn))] px-6 py-2.5 text-base leading-6 text-[hsl(var(--btn-foreground))] transition-opacity hover:opacity-90"
            >
              {resumeIndex !== null ? 'Resume tour' : 'Take a tour'}
            </button>
          </div>
          {resumeIndex !== null && (
            <button
              type="button"
              onClick={() => setPhase(0)}
              className="text-sm text-body-alt underline underline-offset-4 hover:text-foreground"
            >
              Start from the beginning
            </button>
          )}
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
            <p className="text-sm leading-5 text-body-alt">You can return to this tour anytime from your dashboard.</p>
          </div>
          <button
            type="button"
            onClick={finish}
            className="rounded-[32px] border border-black/20 bg-[hsl(var(--btn))] px-6 py-2.5 text-base leading-6 text-[hsl(var(--btn-foreground))] transition-opacity hover:opacity-90"
          >
            Got it
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
  const rect = useTargetRect(step);

  // A left/right card needs ~460px of clear space beside the target (card + offset +
  // padding). A full-width widget (every widget below the lg breakpoint, and the chart
  // at any width) leaves no room on either side, so the card would be pushed off-screen.
  // When neither side fits, drop the card below the target instead; Radix still flips it
  // above if the target sits near the bottom.
  const CARD_SIDE_SPACE = 460;
  // Widget steps also include a preview. Leave room for the explanation, Skip,
  // and footer when deciding whether an anchored card will fit vertically.
  const CARD_STACK_SPACE = step.section ? 320 : 460;
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
      <div className="flex items-center justify-between gap-3 px-4 py-1">
        <span className="text-xs font-medium text-body-alt">{step.section ?? 'Dashboard'}</span>
        <button
          type="button"
          onClick={onSkip}
          title="Save your place and close the tour"
          className="rounded-lg px-2 py-1 text-sm text-body-alt transition-colors hover:bg-secondary hover:text-foreground"
        >
          Skip tour
        </button>
      </div>
      {!step.section && <StepPreview target={step.target} />}
      {/* Text and footer sit in their own 24px-inset block below the preview area. */}
      <div className="flex flex-col gap-6 px-6">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-xl font-semibold leading-8 tracking-normal text-foreground">{step.title}</h3>
          <p className="text-sm leading-5 text-body-alt">{step.body}</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-2">
            <progress
              aria-label="Tour progress"
              value={index + 1}
              max={total}
              className="h-1 w-24 overflow-hidden rounded [&::-webkit-progress-bar]:bg-secondary [&::-webkit-progress-value]:bg-foreground [&::-moz-progress-bar]:bg-foreground"
            />
            <span className="block text-xs font-light leading-4 text-body-alt">
              Step {index + 1} of {total}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {index > 0 && <button
              type="button"
              onClick={onBack}
              className="rounded-[32px] border-[0.5px] border-black/20 bg-btn-secondary px-5 py-2 text-sm leading-5 text-foreground transition-colors hover:bg-secondary"
            >
              Back
            </button>}
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
      {floating || !rect ? (
        <div
          className={cn(
            'pointer-events-none fixed inset-x-0 flex justify-center px-4',
            // Sit in the roomier gap so the highlighted widget stays readable.
            !rect ? 'inset-y-0 items-center' : floatAtBottom ? 'bottom-4' : 'top-4',
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
    const source = visibleTargets(target)[0];
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

function useTargetRect(step: Step) {
  const { target, section } = step;
  const { navigationTourOpen } = useContext(NavigationTourContext);
  const [rect, setRect] = useState<Box | null>(null);
  useEffect(() => {
    const els = () => {
      const primary = visibleTargets(target);
      if (primary.length) return primary;
      return section ? visibleTargets('navigation-menu') : [];
    };
    const measure = () => setRect(unionRect(els()));
    // Measure IMMEDIATELY so the ring and card appear together with no lag, bring the
    // target into view, then keep the position in sync as the scroll settles and on
    // resize/scroll (the `scroll` listener re-measures every frame of the scroll).
    measure();
    // Keep navigation scrolls small; top-align large widgets to leave room for the card.
    els()[0]?.scrollIntoView({ behavior: 'smooth', block: section ? 'nearest' : 'start' });
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [target, section, navigationTourOpen]);
  return rect;
}
