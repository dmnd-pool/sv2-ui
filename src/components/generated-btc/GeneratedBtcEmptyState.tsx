import { Link } from 'wouter';
import { LiAddCircle } from 'solar-icon-react/li';
import { BitcoinCircleIcon } from '@/components/dashboard/icons/BitcoinCircleIcon';

/** Shown when the account has no generated-BTC entries yet. */
export function GeneratedBtcEmptyState() {
  return (
    <div className="flex flex-col items-center px-4 py-16 text-center">
      <BitcoinCircleIcon className="h-12 w-12 text-placeholder" />
      <p className="mt-3 text-base font-semibold text-foreground">No Bitcoin generated yet</p>
      <p className="mt-1 max-w-md text-sm text-body-alt">
        Your mining activity will appear here once your workers begin submitting shares and generating Bitcoin.
      </p>
      <Link
        href="/home"
        className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-border px-5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
      >
        <LiAddCircle className="h-4 w-4" /> Connect a worker
      </Link>
    </div>
  );
}
