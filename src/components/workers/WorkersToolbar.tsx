import { LiMagnifer } from 'solar-icon-react/li';
import { cn } from '@/lib/utils';
import type { WorkersTab } from '@/lib/workersTable';

const TABS: { key: WorkersTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'online', label: 'Online' },
  { key: 'offline', label: 'Offline' },
];

/** Table header: status tabs (with counts) and a name search box. */
export function WorkersToolbar({
  tab,
  onTab,
  counts,
  query,
  onQuery,
}: {
  tab: WorkersTab;
  onTab: (tab: WorkersTab) => void;
  counts: Record<WorkersTab, number>;
  query: string;
  onQuery: (q: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
      <h3 className="text-sm font-semibold text-heading">All workers</h3>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="inline-flex rounded-lg border border-border p-0.5 text-xs">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => onTab(t.key)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors',
                tab === t.key ? 'bg-muted text-foreground' : 'text-body-alt hover:text-foreground',
              )}
            >
              {t.label}
              <span className="rounded bg-muted px-1 py-0.5 text-[10px] text-body-alt">{counts[t.key]}</span>
            </button>
          ))}
        </div>

        <div className="relative">
          <LiMagnifer className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-placeholder" />
          <input
            type="text"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search workers, comma separated..."
            aria-label="Search workers"
            className="w-full rounded-lg border border-border bg-muted py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-placeholder focus:outline-none focus:ring-1 focus:ring-ring sm:w-56"
          />
        </div>
      </div>
    </div>
  );
}
