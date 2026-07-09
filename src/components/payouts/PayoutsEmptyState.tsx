import { LiWallet } from 'solar-icon-react/li';

/** New-user state: no payouts yet. Centered under the page header divider (matches the design). */
export function PayoutsEmptyState() {
  return (
    <div className="flex flex-col items-center px-4 py-16 text-center">
      <LiWallet className="h-12 w-12 text-placeholder" />
      <p className="mt-3 text-base font-semibold text-foreground">No payouts yet</p>
      <p className="mt-1 max-w-md text-sm text-body-alt">
        Your payouts will appear here once mining rewards have been credited and sent to your payout address.
      </p>
    </div>
  );
}
