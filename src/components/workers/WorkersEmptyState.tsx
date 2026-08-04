import { useState } from 'react';
import { LiAltArrowRight } from 'solar-icon-react/li';
import { ConnectionDetails } from './ConnectionDetails';
import { ConnectWorkersDrawer } from './ConnectWorkersDrawer';

/** New-user state: no workers yet, so show the connection details to get started. */
export function WorkersEmptyState() {
  const [guideOpen, setGuideOpen] = useState(false);

  return (
    <div className="border-t-[0.5px] border-border bg-card p-8">
      <div className="flex flex-col items-center text-center">
        <p className="text-xl font-semibold leading-8 text-heading">No workers connected</p>
        <p className="max-w-lg text-sm leading-5 text-body-alt">
          Use the connection details below in your mining hardware. Once a worker starts submitting shares, it will
          appear here.
        </p>
      </div>

      <div className="mx-auto mt-6 max-w-[686px] rounded-[32px] p-8">
        <ConnectionDetails />
      </div>

      <div className="mt-4 flex justify-center">
        <button
          type="button"
          onClick={() => setGuideOpen(true)}
          className="inline-flex items-center gap-2 rounded-[32px] border-[0.5px] border-black/20 bg-btn-secondary px-5 py-2 text-sm leading-5 text-foreground transition-colors hover:opacity-80"
        >
          See setup guide <LiAltArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {guideOpen && <ConnectWorkersDrawer onClose={() => setGuideOpen(false)} />}
    </div>
  );
}
