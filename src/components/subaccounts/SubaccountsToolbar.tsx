import { LiMagnifer } from 'solar-icon-react/li';

/** Table header: section title and a name search box. */
export function SubaccountsToolbar({ query, onQuery }: { query: string; onQuery: (q: string) => void }) {
  return (
    <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
      <h3 className="text-sm font-semibold text-heading">Subaccounts</h3>

      <div className="relative">
        <LiMagnifer className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-placeholder" />
        <input
          type="text"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search subaccount"
          aria-label="Search subaccounts"
          className="w-full rounded-lg border border-border bg-muted py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-placeholder focus:outline-none focus:ring-1 focus:ring-ring sm:w-64"
        />
      </div>
    </div>
  );
}
