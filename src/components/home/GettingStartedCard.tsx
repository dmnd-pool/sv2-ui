import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getUser } from '@/api';
import { useActiveAccountId } from '@/hooks/useActiveAccountId';
import { workerPresenceQueryOptions } from '@/hooks/useAccountData';
import { Link } from 'wouter';
import { LiCheckCircle, LiAltArrowDown, LiAltArrowUp } from 'solar-icon-react/li';
import { activeBitcoinAddress, useAccountProfile } from '@/hooks/useAccountData';
import { cn } from '@/lib/utils';
import type { DmndSession } from '@/api/types';
import { useAggregatedModeContext } from '@/hooks/AggregatedModeProvider';

function hasBitcoinAddress(account: DmndSession | undefined): boolean {
  return activeBitcoinAddress(account) !== null;
}

/**
 * Floating, minimizable setup checklist: connect a worker, set up 2FA, add a
 * payout address. The steps render as a connected stepper with a segmented
 * progress bar; account items link into the account setup flow. Hidden until setup
 * status is known, and whenever every step is complete.
 */
export function GettingStartedCard() {
  const accountId = useActiveAccountId();
  const { aggregated } = useAggregatedModeContext();
  if (aggregated) return null;
  return <AccountGettingStartedCard key={accountId} accountId={accountId} />;
}

function AccountGettingStartedCard({ accountId }: { accountId: string | null }) {
  const [collapsed, setCollapsed] = useState(false);
  const { data: account } = useAccountProfile();
  const cache = useQueryClient();
  const { data: hasWorker } = useQuery({
    ...workerPresenceQueryOptions(cache, getUser(), accountId),
    enabled: !!accountId,
  });

  const items = [
    // A positive result completes the connection step for this session.
    { label: 'Connect a worker', done: hasWorker === true, href: undefined as string | undefined },
    { label: 'Setup 2FA', done: account != null && account.two_factor_secret === null, href: '/account-setup' },
    { label: 'Add payout address', done: hasBitcoinAddress(account), href: '/account-setup' },
  ];
  const completed = items.filter((item) => item.done).length;
  const allDone = completed === items.length;

  if (!account || hasWorker === undefined || allDone) return null;

  // The first unfinished step reads as the current one and carries a darker ring.
  const currentIndex = items.findIndex((item) => !item.done);

  return (
    <div
      className={cn(
        /* The design centres the card on mobile and floats it bottom-right from the
           desktop breakpoint up. */
        'fixed bottom-4 left-1/2 z-30 flex w-[330px] max-w-[calc(100%-2rem)] -translate-x-1/2 flex-col items-center gap-[15px] rounded-3xl bg-secondary pt-6 shadow-2xl',
        'lg:left-auto lg:right-4 lg:translate-x-0',
        collapsed && 'pb-6',
      )}
    >
      <div className="flex w-full items-start justify-between gap-4 px-8">
        <div className="flex flex-col">
          <p className="text-base font-medium leading-7 text-foreground">
            Getting started
          </p>
          <p className="text-xs leading-3 text-body-alt">
            Finish setting up your dashboard
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand' : 'Collapse'}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[32px] bg-btn-secondary p-2 text-body-alt transition-colors hover:text-foreground"
        >
          {collapsed ? <LiAltArrowUp className="h-4 w-4" /> : <LiAltArrowDown className="h-4 w-4" />}
        </button>
      </div>

      {!collapsed && (
        <div className="flex w-full flex-col gap-4 rounded-3xl bg-muted px-8 pb-8 pt-6">
          <ul>
            {items.map((item, i) => {
              const isLast = i === items.length - 1;
              const row = (
                <span className="flex items-start gap-3 text-base leading-6">
                  {/* Stepper rail: a 24px marker over a 40px dashed connector. The last
                      step has no connector, so the rail stops at its marker. */}
                  <span className="flex flex-col items-center">
                    {item.done ? (
                      <LiCheckCircle className="h-6 w-6 shrink-0 text-success" />
                    ) : (
                      <span
                        className={cn(
                          'h-6 w-6 shrink-0 rounded-full border-2',
                          i === currentIndex ? 'border-foreground' : 'border-border',
                        )}
                      />
                    )}
                    {!isLast && <span className="h-10 w-0 border-l-[0.5px] border-dashed border-border" />}
                  </span>
                  <span className={cn(item.done ? 'text-body-alt line-through' : 'text-foreground')}>
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

          {/* The rule runs the full card width rather than stopping at the padding. */}
          <div className="-mx-8 h-px bg-border" />

          <div className="flex items-center justify-between">
            <span className="text-sm leading-5 text-foreground">
              {completed}/{items.length} Complete
            </span>
            <div className="flex gap-[3px]">
              {items.map((_, i) => (
                <span
                  key={i}
                  className={cn('h-0.5 w-5 rounded', i < completed ? 'bg-foreground' : 'bg-secondary')}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
