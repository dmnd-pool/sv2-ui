import { BdWalletMoney } from 'solar-icon-react/bd';

/**
 * Shown when the account has no payouts.
 *
 * Like the subaccounts empty state, the card carries a top border only and no radius;
 * that is how the frame draws it. No call-to-action is drawn here, so none is added.
 */
export function PayoutsEmptyState() {
  return (
    <div className="flex flex-col items-center gap-6 border-t-[0.5px] border-border bg-card px-4 py-8 text-center sm:p-8">
      <BdWalletMoney className="h-16 w-16 text-placeholder" />
      <div>
        <p className="font-heading text-xl font-semibold leading-8 text-foreground">No payouts yet</p>
        <p className="mx-auto max-w-[582px] text-sm leading-5 text-body-alt">
          Your payouts will appear here once mining rewards have been credited and sent to your payout address.
        </p>
      </div>
    </div>
  );
}
