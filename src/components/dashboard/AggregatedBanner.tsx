import { BdInfoCircle } from 'solar-icon-react/bd';

/**
 * The blue notice shown at the top of every page while aggregated mode is on. It
 * explains that worker, earnings, and performance data are being combined. Aggregated
 * mode itself is controlled by the single switch in the top bar or mobile sidebar.
 */
export function AggregatedBanner() {
  return (
    <div className="flex flex-col bg-toast-info px-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6">
      <div className="flex min-w-0 flex-1 items-start gap-1">
        {/* The icon sits 2px low so it lines up with the title's cap height. */}
        <BdInfoCircle className="mt-0.5 h-5 w-5 shrink-0 text-info" aria-hidden />
        <div className="flex min-w-0 flex-col">
          <p className="text-sm font-bold leading-5 text-foreground">Viewing Aggregated Dashboard</p>
          <p className="text-xs leading-4 text-foreground sm:hidden">
            You&apos;re viewing combined data across all subaccounts.
          </p>
          <p className="hidden text-sm leading-5 text-foreground sm:block">
            You&apos;re viewing combined workers, earnings, and mining performance across all subaccounts.
          </p>
        </div>
      </div>
    </div>
  );
}
