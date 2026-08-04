import { Plus } from 'lucide-react';
import { BdLayersMinimalistic } from 'solar-icon-react/bd';

/**
 * New-user state: no subaccounts yet, with the primary Create call-to-action.
 *
 * The card carries a top border only and no radius, unlike every other content card on
 * the page; that is how the frame draws it.
 */
export function SubaccountsEmptyState({ onCreate, canCreate }: { onCreate: () => void; canCreate: boolean }) {
  return (
    <div className="flex flex-col items-center gap-4 border-t-[0.5px] border-border bg-card p-4 text-center lg:p-8">
      <BdLayersMinimalistic className="h-16 w-16 text-placeholder" />
      <div>
        <p className="font-heading text-xl font-semibold leading-8 text-foreground">No subaccounts yet</p>
        <p className="mx-auto max-w-[582px] text-sm leading-5 text-body-alt">
          Subaccounts help you separate workers, earnings, and payouts across different mining operations. Create a
          subaccount if you manage multiple farms, locations, or clients.
        </p>
      </div>
      {canCreate && (
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex h-9 items-center gap-2 rounded-[32px] border border-black/20 bg-[hsl(var(--btn))] px-5 text-sm leading-5 text-[hsl(var(--btn-foreground))] transition-opacity hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" /> Create Subaccount
        </button>
      )}
    </div>
  );
}
