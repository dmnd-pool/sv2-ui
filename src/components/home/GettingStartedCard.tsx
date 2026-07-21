import { useState } from 'react';
import { Link } from 'wouter';
import { LiCheckCircle, LiAltArrowDown, LiAltArrowUp, LiCloseCircle } from 'solar-icon-react/li';
import { useAccountAllWorkers, useAccountProfile } from '@/hooks/useAccountData';
import { cn } from '@/lib/utils';
import type { DmndSession } from '@/api/types';

// Once the checklist is complete the card shows a "good to go" state; dismissing it
// is remembered so it doesn't reappear on the next visit.
const DISMISS_KEY = 'dmnd.gettingStarted.dismissed';

function hasBitcoinAddress(account: DmndSession | undefined): boolean {
  const addrs = account?.bitcoin_addresses;
  if (Array.isArray(addrs)) return addrs.length > 0;
  if (addrs && typeof addrs === 'object') return Object.keys(addrs).length > 0;
  return false;
}

/**
 * Floating, minimizable setup checklist: connect a worker, set up 2FA, add a
 * payout address. The steps render as a connected stepper with a segmented
 * progress bar; account items link into the account setup flow. When every step is
 * done it flips to a "Setup complete" state the user can dismiss (remembered), so
 * they get confirmation before the card goes away rather than it vanishing silently.
 */
export function GettingStartedCard() {
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });
  const { data: account } = useAccountProfile();
  const { data: workers } = useAccountAllWorkers();

  const items = [
    // This is a one-time setup checklist, not a live status widget, so "connect a
    // worker" stays done once the account has ever had one: /api/workers/all lists
    // every worker ever connected, which is exactly that. A rig going offline later
    // is a monitoring concern (the stat cards and the workers page), and shouldn't
    // reopen a setup step the miner already completed.
    { label: 'Connect a worker', done: (workers?.length ?? 0) > 0, href: undefined as string | undefined },
    { label: 'Setup 2FA', done: account != null && account.two_factor_secret === null, href: '/account-setup' },
    { label: 'Add payout address', done: hasBitcoinAddress(account), href: '/account-setup' },
  ];
  const completed = items.filter((item) => item.done).length;
  const allDone = completed === items.length;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore storage failures; the card just reappears next load */
    }
    setDismissed(true);
  };

  // Once complete and acknowledged, stop showing it.
  if (allDone && dismissed) return null;

  return (
    <div className="fixed bottom-4 right-4 z-30 w-[calc(100%-2rem)] max-w-[336px] rounded-3xl border border-border bg-popover shadow-2xl">
      <div className={cn('flex items-start justify-between gap-2 px-6 pt-6', collapsed && 'pb-6')}>
        <div>
          <p className="text-sm font-semibold text-heading">{allDone ? 'Setup complete' : 'Getting started'}</p>
          <p className="mt-1 text-xs text-body-alt">
            {allDone ? 'Your dashboard is good to go!' : 'Finish setting up your dashboard'}
          </p>
        </div>
        {allDone ? (
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-placeholder transition-colors hover:bg-muted hover:text-foreground"
          >
            <LiCloseCircle className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand' : 'Collapse'}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-placeholder transition-colors hover:bg-muted hover:text-foreground"
          >
            {collapsed ? <LiAltArrowUp className="h-4 w-4" /> : <LiAltArrowDown className="h-4 w-4" />}
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="px-6 pb-6 pt-4">
          <ul>
            {items.map((item, i) => {
              const isLast = i === items.length - 1;
              const row = (
                <span className="flex items-start gap-3 text-sm">
                  {/* Stepper rail: a 24px circle over a dashed vertical connector that
                      runs below every item (the last one leads into the footer rule). */}
                  <span className="flex flex-col items-center self-stretch">
                    {item.done ? (
                      <LiCheckCircle className="h-6 w-6 shrink-0 text-success" />
                    ) : (
                      <span className="h-6 w-6 shrink-0 rounded-full border-2 border-border" />
                    )}
                    <span className="w-0 flex-1 border-l border-dashed border-border" />
                  </span>
                  <span
                    className={cn(
                      isLast ? 'pb-2 pt-0.5' : 'pb-5 pt-0.5',
                      item.done ? 'text-body-alt line-through' : 'text-foreground',
                    )}
                  >
                    {item.label}
                  </span>
                </span>
              );
              return (
                <li key={item.label}>
                  {item.href && !item.done ? (
                    <Link href={item.href} className="block transition-opacity hover:opacity-80">
                      {row}
                    </Link>
                  ) : (
                    row
                  )}
                </li>
              );
            })}
          </ul>

          <div className="flex items-center justify-between border-t border-border pt-4">
            <span className="text-xs text-body-alt">
              {completed}/{items.length} Complete
            </span>
            <div className="flex gap-[3px]">
              {items.map((_, i) => (
                <span key={i} className={cn('h-0.5 w-5 rounded-full', i < completed ? 'bg-success' : 'bg-border')} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
