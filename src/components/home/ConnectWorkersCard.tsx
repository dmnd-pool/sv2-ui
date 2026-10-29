import { LiAltArrowRight } from 'solar-icon-react/li';
import { useState } from 'react';
import { ConnectionDetails } from '@/components/workers/ConnectionDetails';
import { ConnectWorkersDrawer } from '@/components/workers/ConnectWorkersDrawer';
import { useConnectionAccount } from '@/components/workers/ConnectionDetails';

/** The credentials a miner points hardware at: pool URL, username, and the two
 * scheme passwords (PPLNS = account token, FPPS = fpps token). */
export function ConnectWorkersCard() {
  const [guideOpen, setGuideOpen] = useState(false);
  const { aggregated, accountName } = useConnectionAccount();

  return (
    <div className="h-full border-[0.5px] border-border bg-card p-3 lg:p-4">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="!font-body text-lg font-semibold leading-7 text-heading-alt">{!aggregated && accountName ? `Connect workers to ${accountName}` : 'Connect workers'}</h3>
          {!aggregated && <button
            type="button"
            onClick={() => setGuideOpen(true)}
            className="inline-flex shrink-0 items-center gap-1 text-sm leading-5 text-foreground transition-colors hover:text-body-alt"
          >
            Setup guide
            <LiAltArrowRight className="h-3.5 w-3.5" />
          </button>}
        </div>
        <div className="h-px w-full bg-border" />
      </div>
      <div className="mt-2">
        <ConnectionDetails />
      </div>
      {!aggregated && guideOpen && <ConnectWorkersDrawer onClose={() => setGuideOpen(false)} />}
    </div>
  );
}
