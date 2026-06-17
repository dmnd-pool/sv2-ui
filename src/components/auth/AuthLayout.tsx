import { useEffect, useState, type ReactNode } from 'react';
import { LiAltArrowLeft } from 'solar-icon-react/li';
import { ThemeToggle } from '@/components/auth/ThemeToggle';
import { DmndLogo } from '@/components/auth/Logo';
import { cn } from '@/lib/utils';

interface AuthLayoutProps {
  children: ReactNode;
  /** Optional back affordance, shown top-left instead of the logo. */
  onBack?: () => void;
  /** Optional top-right content, e.g. a "sign up as broker" link. */
  topRight?: ReactNode;
  /** When true, shows the branded auto-rotating marketing carousel (large screens). */
  marketing?: boolean;
}

/**
 * Shell for the pre-auth screens: a #0A0A0A canvas with
 * 8px of breathing room around rounded #171717 containers, the form on the left
 * and an optional branded panel on the right. The form card scrolls internally
 * on short viewports so the page itself never scrolls.
 */
export function AuthLayout({ children, onBack, topRight, marketing }: AuthLayoutProps) {
  return (
    <div className="dmnd-auth flex h-screen w-full overflow-hidden bg-background p-0 text-foreground lg:bg-canvas lg:p-2">
      <div className="flex min-h-0 flex-1 lg:gap-2">
        <div className="relative flex flex-1 flex-col overflow-hidden bg-background">
          <div className="flex items-center justify-between px-6 py-6 lg:px-24 lg:py-8">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1 text-sm text-foreground transition-colors hover:text-foreground"
              >
                <LiAltArrowLeft className="h-4 w-4" />
                Back
              </button>
            ) : (
              <DmndLogo />
            )}
            <div className="flex items-center gap-4">
              {topRight}
              <ThemeToggle />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 pb-6 lg:px-24">
            <div className="flex min-h-full items-center justify-center">
              <div className="mx-auto w-full max-w-[467px] py-4">{children}</div>
            </div>
          </div>
        </div>

        {marketing && <MarketingPanel />}
      </div>
    </div>
  );
}

// The carousel slides, auto-rotating.
const SLIDES = [
  { headline: 'Enterprise Ready', sub: 'Manage hundreds of miners from a single dashboard.' },
  {
    headline: 'Built on Stratum V2',
    sub: 'Encrypted connections, better efficiency, and more control over your mining operation.',
  },
  { headline: 'Transparent Earnings', sub: 'Track every satoshi, payouts, and reward history in real time.' },
];
const SLIDE_INTERVAL_MS = 5000;

function MarketingPanel() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setActive((i) => (i + 1) % SLIDES.length), SLIDE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const slide = SLIDES[active];

  return (
    <div className="relative hidden w-[33%] shrink-0 flex-col justify-end overflow-hidden bg-background p-20 lg:flex">
      {/* Fixed maroon art (stays put across slides). */}
      <SidePanelArt />

      <div className="relative">
        <div className="mb-2.5 flex gap-[3px]">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Show slide ${i + 1}`}
              className={cn('h-0.5 w-6 rounded-full transition-all', i === active ? 'bg-foreground' : 'bg-foreground/25')}
            />
          ))}
        </div>
        <h2 className="text-2xl font-semibold leading-9 tracking-[-1px] text-foreground">{slide.headline}</h2>
        <p className="mt-1 max-w-xs text-sm font-normal leading-5 text-body-alt">{slide.sub}</p>
      </div>
    </div>
  );
}

/**
 * Static panel art: a mass spilling from the top-left and a nub in the
 * bottom-right. Each piece sits in a box locked to the design panel's 469x784
 * ratio, so its offsets scale with the panel width rather than its height, and
 * is pinned to its own corner (mass to the top, nub to the bottom). At the
 * design ratio this renders identically to placing the images directly on the
 * panel; on taller or shorter panels it keeps each piece anchored to its corner
 * instead of drifting with the height.
 */
function SidePanelArt() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-x-0 top-0 aspect-[469/784]">
        <img src="/panel-art-top.svg" alt="" className="absolute" style={{ left: '-30%', top: '-8%', width: '133.3%' }} />
      </div>
      <div className="absolute inset-x-0 bottom-0 aspect-[469/784]">
        <img src="/panel-art-nub.svg" alt="" className="absolute" style={{ left: '85.7%', top: '64%', width: '133.3%' }} />
      </div>
    </div>
  );
}
