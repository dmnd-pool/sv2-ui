import { useMemo, useState, type ReactNode } from 'react';
import { LiAltArrowDown, LiMagnifer, LiSort } from 'solar-icon-react/li';
import {
  filterPplnsDailyWork,
  formatPplnsAverageHashrate,
  formatPplnsDifficulty,
  formatPplnsWorkDay,
  searchPplnsDailyWork,
  totalDailyWorkNetSats,
} from '@/lib/pplnsProjection';
import { formatBtcFromSats } from '@/lib/payoutsTable';
import { cn } from '@/lib/utils';
import type { PplnsProjection, PplnsProjectionDailyWork } from '@/api/types';
import {
  EMPTY_GBTC_FILTER_DRAFT,
  GeneratedBtcFilter,
  gbtcDraftToFilter,
  isGbtcDraftActive,
  type GbtcFilterDraft,
} from '@/components/generated-btc/GeneratedBtcFilter';

function StateMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{body}</p>
    </div>
  );
}

const HEADERS = ['Work day (UTC)', 'Retained work', 'Average hashrate', 'Total PPLNS value'];

function BtcAmount({ sats }: { sats: number }) {
  return (
    <>
      {formatBtcFromSats(sats)} <span className="text-xs leading-4 text-body-alt">BTC</span>
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col">
      <p className="truncate text-xs leading-4 text-body-alt">{label}</p>
      <p className="truncate text-sm leading-5 text-foreground">{children}</p>
    </div>
  );
}

function DailyWorkCard({ day }: { day: PplnsProjectionDailyWork }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-b-[0.5px] border-border px-3 py-3">
      <Field label={HEADERS[0]}>{formatPplnsWorkDay(day.work_day)}</Field>
      <Field label={HEADERS[1]}>{formatPplnsDifficulty(day.retained_difficulty)}</Field>
      <Field label={HEADERS[2]}>{formatPplnsAverageHashrate(day.retained_difficulty)}</Field>
      <Field label={HEADERS[3]}>
        <BtcAmount sats={day.total_net_sats} />
      </Field>
    </div>
  );
}

interface TableEmpty {
  title: string;
  hint: string;
  clearLabel: string;
  onClear: () => void;
}

function EmptyRow({ empty }: { empty: TableEmpty }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="text-sm font-semibold text-foreground">{empty.title}</p>
      <p className="mt-1 text-sm text-body-alt">{empty.hint}</p>
      <button
        type="button"
        onClick={empty.onClear}
        className="mt-4 inline-flex items-center rounded-[32px] border-[0.5px] border-black/20 bg-btn-secondary px-5 py-2 text-sm leading-5 text-foreground transition-opacity hover:opacity-80"
      >
        {empty.clearLabel}
      </button>
    </div>
  );
}

function ProjectionToolbar({
  query,
  onQuery,
  filter,
  onApplyFilter,
  onResetFilter,
}: {
  query: string;
  onQuery: (query: string) => void;
  filter: GbtcFilterDraft;
  onApplyFilter: (filter: GbtcFilterDraft) => void;
  onResetFilter: () => void;
}) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const filterActive = isGbtcDraftActive(filter);

  const searchField = (
    <div className="relative flex-1 sm:flex-none">
      <LiMagnifer className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground" />
      <span
        aria-hidden
        className="pointer-events-none absolute left-[42px] top-1/2 h-6 w-px -translate-y-1/2 bg-border"
      />
      <input
        type="text"
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder="Search PPLNS projection"
        aria-label="Search PPLNS projection"
        className="h-10 w-full rounded-xl bg-muted py-2 pl-[54px] pr-4 text-sm leading-5 text-foreground placeholder:text-placeholder focus:outline-none focus:ring-1 focus:ring-ring sm:w-[252px]"
      />
    </div>
  );

  return (
    <div className="relative flex flex-col gap-3 border-b-[0.5px] border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="!font-body text-lg font-bold leading-7 text-foreground">PPLNS projection</h3>

        <div className="flex items-center gap-2 sm:hidden">
          <button
            type="button"
            onClick={() => setSearchOpen((open) => !open)}
            aria-expanded={searchOpen}
            aria-label="Search PPLNS daily work"
            className="flex h-8 w-8 items-center justify-center rounded-[32px] border-[0.5px] border-black/20 bg-btn-secondary text-foreground transition-opacity hover:opacity-80"
          >
            <LiMagnifer className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setFilterOpen((open) => !open)}
            aria-expanded={filterOpen}
            aria-haspopup="dialog"
            aria-label="Filter PPLNS daily work"
            className="relative flex h-8 w-8 items-center justify-center rounded-[32px] border-[0.5px] border-black/20 bg-btn-secondary text-foreground transition-opacity hover:opacity-80"
          >
            <LiSort className="h-4 w-4" />
            {filterActive && (
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[hsl(var(--btn))]" aria-hidden />
            )}
          </button>
        </div>
      </div>

      {searchOpen && <div className="sm:hidden">{searchField}</div>}

      {filterOpen && (
        <GeneratedBtcFilter
          applied={filter}
          onApply={onApplyFilter}
          onReset={onResetFilter}
          onClose={() => setFilterOpen(false)}
          copy={{
            title: 'Filter PPLNS projection',
            description: 'Find daily PPLNS work by date.',
            ariaLabel: 'Filter PPLNS daily work',
          }}
        />
      )}

      <div className="hidden items-center gap-2 sm:flex">
        {searchField}
        <button
          type="button"
          onClick={() => setFilterOpen((open) => !open)}
          aria-expanded={filterOpen}
          aria-haspopup="dialog"
          className={cn(
            'inline-flex h-9 items-center gap-2 rounded-[32px] border-[0.5px] border-black/20 bg-btn-secondary px-5 text-sm leading-5 text-foreground transition-opacity hover:opacity-80',
            filterActive && 'font-medium',
          )}
        >
          <LiSort className="h-3.5 w-3.5" />
          Filter
          {filterActive ? (
            <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--btn))]" aria-hidden />
          ) : (
            <LiAltArrowDown className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}

function DailyWorkTable({ dailyWork, empty }: { dailyWork: PplnsProjectionDailyWork[]; empty?: TableEmpty }) {
  const totalNetSats = totalDailyWorkNetSats(dailyWork);
  const showTotal = dailyWork.length > 0 || empty === undefined;

  return (
    <>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[720px] border-collapse text-sm leading-5">
          <thead>
            <tr className="border-b-[0.5px] border-border bg-muted text-body-alt">
              {HEADERS.map((header) => (
                <th key={header} className="px-6 py-4 text-left font-normal">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {empty && (
              <tr>
                <td colSpan={4}>
                  <EmptyRow empty={empty} />
                </td>
              </tr>
            )}
            {dailyWork.map((day) => (
              <tr key={day.work_day} className="border-b-[0.5px] border-border">
                <td className="whitespace-nowrap px-6 py-4 font-medium text-foreground">
                  {formatPplnsWorkDay(day.work_day)}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-foreground">
                  {formatPplnsDifficulty(day.retained_difficulty)}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-foreground">
                  {formatPplnsAverageHashrate(day.retained_difficulty)}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-foreground">
                  <BtcAmount sats={day.total_net_sats} />
                </td>
              </tr>
            ))}
          </tbody>
          {showTotal && (
            <tfoot>
              <tr>
                <td colSpan={3} className="px-6 py-4 text-right font-semibold text-foreground">
                  Grand total
                </td>
                <td className="whitespace-nowrap px-6 py-4 font-semibold text-foreground">
                  <BtcAmount sats={totalNetSats} />
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="sm:hidden">
        {empty && <EmptyRow empty={empty} />}
        {dailyWork.map((day) => (
          <DailyWorkCard key={day.work_day} day={day} />
        ))}
        {showTotal && (
          <div className="flex items-center justify-between px-3 py-4 text-sm text-foreground">
            <span className="font-semibold">Grand total</span>
            <span className="font-semibold">
              <BtcAmount sats={totalNetSats} />
            </span>
          </div>
        )}
      </div>
    </>
  );
}

function ProjectionBody({ dailyWork }: { dailyWork: PplnsProjectionDailyWork[] }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<GbtcFilterDraft>(EMPTY_GBTC_FILTER_DRAFT);
  const visible = useMemo(() => {
    const byDate = filterPplnsDailyWork(dailyWork, gbtcDraftToFilter(filter, Date.now()));
    return searchPplnsDailyWork(byDate, query);
  }, [dailyWork, filter, query]);

  const resetFilter = () => setFilter(EMPTY_GBTC_FILTER_DRAFT);
  const filterActive = isGbtcDraftActive(filter);
  const hasQuery = query.trim().length > 0;
  const empty =
    visible.length > 0
      ? undefined
      : filterActive
        ? {
            title: 'No daily work matches this filter',
            hint: 'Adjust or clear your date filter.',
            clearLabel: 'Clear filters',
            onClear: resetFilter,
          }
        : hasQuery
          ? {
              title: 'No daily work found',
              hint: 'Try another search or clear it.',
              clearLabel: 'Clear search',
              onClear: () => setQuery(''),
            }
          : undefined;

  return (
    <div className="rounded-xl border border-border bg-card">
      <ProjectionToolbar
        query={query}
        onQuery={setQuery}
        filter={filter}
        onApplyFilter={setFilter}
        onResetFilter={resetFilter}
      />
      <DailyWorkTable dailyWork={visible} empty={empty} />
    </div>
  );
}

export function PplnsProjectionPanel({
  projection,
  isLoading,
  isError,
}: {
  /** `null` means the cache holds no projection for the latest boundary yet. */
  projection: PplnsProjection | null | undefined;
  isLoading: boolean;
  isError: boolean;
}) {
  if (isLoading) return <div className="h-80 animate-pulse rounded-xl border border-border bg-muted" />;
  if (isError) {
    return (
      <StateMessage
        title="Projection could not be loaded"
        body="The dashboard could not load the latest PPLNS projection. Try again shortly."
      />
    );
  }
  if (projection === null) {
    return (
      <StateMessage
        title="Projection temporarily unavailable"
        body="No projection is available for the latest PPLNS boundary yet. The cache may still be refreshing; try again shortly."
      />
    );
  }
  return projection ? <ProjectionBody dailyWork={projection.daily_work} /> : null;
}
