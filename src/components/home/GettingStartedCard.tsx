import { useState } from 'react';
import { Link } from 'wouter';
import { LiCheckCircle, LiAltArrowDown, LiAltArrowUp } from 'solar-icon-react/li';
import { useAccountProfile, useAccountWorkers } from '@/hooks/useAccountData';
import { cn } from '@/lib/utils';
import type { DmndSession } from '@/api/types';

function hasBitcoinAddress(account: DmndSession | undefined): boolean {
  const addrs = account?.bitcoin_addresses;
  if (Array.isArray(addrs)) return addrs.length > 0;
  if (addrs && typeof addrs === 'object') return Object.keys(addrs).length > 0;
  return false;
}

/**
 * Floating, minimizable setup checklist: connect a worker, set up 2FA, add a
 * payout address. The steps render as a connected stepper with a segmented
 * progress bar; account items link into the account setup flow and the card hides
 * itself once everything is done.
 */
export function GettingStartedCard({ from, to }: { from: string; to: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const { data: account } = useAccountProfile();
  const { data: workers } = useAccountWorkers(from, to);

  const items = [
    { label: 'Connect a worker', done: (workers?.workers.length ?? 0) > 0, href: undefined as string | undefined },
    { label: 'Setup 2FA', done: account != null && account.two_factor_secret === null, href: '/account-setup' },
    { label: 'Add payout address', done: hasBitcoinAddress(account), href: '/account-setup' },
  ];
  const completed = items.filter((item) => item.done).length;

  // Don't nag once the account is fully set up.
  if (completed === items.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-30 w-[calc(100%-2rem)] max-w-xs rounded-xl border border-border bg-popover shadow-2xl">
      <div className="flex items-start justify-between gap-2 px-4 pt-4">
        <div>
          <p className="text-sm font-semibold text-heading">Getting started</p>
          <p className="mt-1 text-xs text-body-alt">Finish setting up your dashboard</p>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand' : 'Collapse'}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-placeholder transition-colors hover:bg-muted hover:text-foreground"
        >
          {collapsed ? <LiAltArrowUp className="h-4 w-4" /> : <LiAltArrowDown className="h-4 w-4" />}
        </button>
      </div>

      {!collapsed && (
        <div className="px-4 pb-4 pt-3">
          <ul>
            {items.map((item, i) => {
              const isLast = i === items.length - 1;
              const row = (
                <span className="flex items-start gap-2.5 text-sm">
                  <span className="flex flex-col items-center self-stretch">
                    {item.done ? (
                      <LiCheckCircle className="h-5 w-5 shrink-0 text-success" />
                    ) : (
                      <span className="h-5 w-5 shrink-0 rounded-full border-2 border-border" />
                    )}
                    {!isLast && <span className="my-1 w-px flex-1 bg-border" />}
                  </span>
                  <span
                    className={cn(
                      isLast ? 'pb-0' : 'pb-5',
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

          <div className="mt-2 flex items-center justify-between border-t border-border pt-3">
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
