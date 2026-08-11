import { useMemo, useState } from 'react';
import { LiCopy, LiMagnifer } from 'solar-icon-react/li';
import { useBrokerAuth } from '@/auth';
import { BrokerShell } from '@/components/broker/BrokerShell';
import { BrokerStatCards } from '@/components/broker/BrokerStatCards';
import { BrokerMinersTable } from '@/components/broker/BrokerMinersTable';
import { BrokerEmptyState } from '@/components/broker/BrokerEmptyState';
import { useBrokerMiners } from '@/hooks/useBrokerMiners';
import { averageBrokerFee, searchBrokerMiners, sumBrokerHashrate } from '@/lib/brokerTable';

/**
 * The broker dashboard: the miners assigned to this broker's referral code, with
 * portfolio totals above them.
 *
 * The frames title this "Welcome, {firstName}", but a broker session carries only
 * an id, an email and a reference code, so there is no name to greet with. The
 * design's own new-user frame supplies the wording used instead.
 */
export function BrokerHome() {
  const { session } = useBrokerAuth();
  const { data, isLoading, isError, refetch } = useBrokerMiners();
  const miners = useMemo(() => data ?? [], [data]);
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState(false);

  const visible = useMemo(() => searchBrokerMiners(miners, query), [miners, query]);
  const totals = useMemo(
    () => ({ hashrate: sumBrokerHashrate(miners), fee: averageBrokerFee(miners) }),
    [miners],
  );

  const referralCode = session?.referenceCode ?? '';

  const copyCode = () => {
    if (!referralCode) return;
    void navigator.clipboard?.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const hasMiners = !isLoading && !isError && miners.length > 0;

  return (
    <BrokerShell>
      <div className="space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-heading text-2xl font-semibold leading-9 tracking-[-1px] text-heading">
              Broker dashboard
            </h2>
            <p className="mt-1 text-sm leading-5 text-body-alt">
              Monitor the miners assigned to your referral code and track their mining performance.
            </p>
          </div>
          {hasMiners && referralCode && (
            <button
              type="button"
              onClick={copyCode}
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-[32px] border border-black/20 bg-[hsl(var(--btn))] px-5 text-sm leading-5 text-[hsl(var(--btn-foreground))] transition-opacity hover:opacity-90"
            >
              {copied ? 'Referral code copied' : referralCode}
              <LiCopy className="h-3.5 w-3.5" />
            </button>
          )}
        </header>

        {isLoading ? (
          <div className="h-80 animate-pulse border-[0.5px] border-border bg-muted" />
        ) : isError ? (
          <div className="border-[0.5px] border-border bg-card p-10 text-center">
            <p className="text-base font-semibold text-foreground">Couldn't load your miners</p>
            <p className="mt-1 text-sm text-body-alt">Something went wrong reading your portfolio.</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-4 inline-flex h-9 items-center rounded-[32px] border-[0.5px] border-black/20 bg-btn-secondary px-5 text-sm leading-5 text-foreground transition-opacity hover:opacity-80"
            >
              Try again
            </button>
          </div>
        ) : miners.length === 0 ? (
          <BrokerEmptyState referralCode={referralCode} onCopy={copyCode} copied={copied} />
        ) : (
          <>
            <BrokerStatCards
              minerCount={miners.length}
              totalHashrate={totals.hashrate}
              averageFee={totals.fee}
            />
            <div>
              <div className="flex flex-col gap-3 rounded-t-3xl border-[0.5px] border-b-0 border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
                <h3 className="!font-body text-lg font-bold leading-7 text-foreground">Miners</h3>
                <div className="relative">
                  <LiMagnifer className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-body-alt" />
                  <span
                    aria-hidden
                    className="pointer-events-none absolute left-[42px] top-1/2 h-6 w-px -translate-y-1/2 bg-border"
                  />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search miner"
                    aria-label="Search miner"
                    className="h-10 w-full rounded-xl bg-muted py-2 pl-[54px] pr-4 text-sm leading-5 text-foreground placeholder:text-placeholder focus:outline-none focus:ring-1 focus:ring-ring sm:w-[252px]"
                  />
                </div>
              </div>
              <BrokerMinersTable miners={visible} />
            </div>
          </>
        )}
      </div>
    </BrokerShell>
  );
}
