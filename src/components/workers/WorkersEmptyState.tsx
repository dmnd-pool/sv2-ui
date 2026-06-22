import { LiAltArrowRight } from 'solar-icon-react/li';
import { MiningIcon } from '@/components/dashboard/icons/MiningIcon';
import { ConnectionDetails } from './ConnectionDetails';

const SETUP_TUTORIAL_URL = 'https://onboarding.dmnd.work';

/** New-user state: no workers yet, so show the connection details to get started. */
export function WorkersEmptyState() {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex flex-col items-center px-4 py-8 text-center text-placeholder">
        <MiningIcon className="h-14 w-14" />
        <p className="mt-3 text-base font-semibold text-foreground">No workers connected</p>
        <p className="mt-1 max-w-md text-sm text-body-alt">
          Use the connection details below in your mining hardware. Once a worker starts submitting shares, it will
          appear here.
        </p>
      </div>

      <div className="mx-auto max-w-xl rounded-xl bg-muted px-4">
        <ConnectionDetails />
      </div>

      <div className="mt-4 flex justify-center">
        <a
          href={SETUP_TUTORIAL_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm font-medium text-body-alt transition-colors hover:text-foreground"
        >
          See setup tutorial <LiAltArrowRight className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}
