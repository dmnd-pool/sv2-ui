import { LiLayersMinimalistic, LiAddCircle } from 'solar-icon-react/li';

/** New-user state: no subaccounts yet, with the primary Create call-to-action. */
export function SubaccountsEmptyState({ onCreate, canCreate }: { onCreate: () => void; canCreate: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-col items-center px-4 py-16 text-center">
        <LiLayersMinimalistic className="h-12 w-12 text-placeholder" />
        <p className="mt-3 text-base font-semibold text-foreground">No subaccounts yet</p>
        <p className="mt-1 max-w-md text-sm text-body-alt">
          Subaccounts help you separate workers, earnings, and payouts across different mining operations. Create a
          subaccount if you manage multiple farms, locations, or clients.
        </p>
        {canCreate && (
          <button
            type="button"
            onClick={onCreate}
            className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-[hsl(var(--btn))] px-4 py-2 text-sm font-medium text-[hsl(var(--btn-foreground))] transition-opacity hover:opacity-90"
          >
            <LiAddCircle className="h-4 w-4" /> Create Subaccount
          </button>
        )}
      </div>
    </div>
  );
}
