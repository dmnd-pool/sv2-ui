import { useMemo, useState, type ReactNode, type Dispatch, type SetStateAction } from 'react';
import { LiAltArrowDown, LiMagnifer, LiSort, LiExport } from 'solar-icon-react/li';
import {
  filterPplnsDailyWork,
  formatPplnsAverageHashrate,
  formatPplnsDifficulty,
  formatPplnsWorkDay,
  searchPplnsDailyWork,
  pplnsDailyWorkToCsv,
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
import { PplnsProjectionStatCards } from './PplnsProjectionStatCards';
import { CellCheckbox } from '@/components/ui/CellCheckbox';
import { SelectionActions } from '@/components/ui/TableToolbar';
import { downloadCsv } from '@/lib/utils';

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
    <div className="px-4 py-8 text-center">
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

function DailyWorkTable({ dailyWork, empty, selectable, selected, setSelected }: { dailyWork: PplnsProjectionDailyWork[]; empty?: TableEmpty; selectable: boolean; selected: Set<string>; setSelected: Dispatch<SetStateAction<Set<string>>> }) {
  const allSelected = dailyWork.length > 0 && dailyWork.every((day) => selected.has(day.work_day));
  const someSelected = dailyWork.some((day) => selected.has(day.work_day));
  const toggleAll = () => setSelected((previous) => {
    const next = new Set(previous);
    for (const day of dailyWork) {
      if (allSelected) next.delete(day.work_day);
      else next.add(day.work_day);
    }
    return next;
  });
  const toggleOne = (id: string) => setSelected((previous) => {
    const next = new Set(previous);
    if (!next.delete(id)) next.add(id);
    return next;
  });
  return (
    <>
      {selectable && <SelectionActions count={dailyWork.filter((day) => selected.has(day.work_day)).length}
        onExport={() => downloadCsv(pplnsDailyWorkToCsv(dailyWork.filter((day) => selected.has(day.work_day))), 'pplns_projection.csv')}
        onClear={() => setSelected(new Set())} />}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[720px] border-collapse text-sm leading-5">
          <thead>
            <tr className="border-b-[0.5px] border-border bg-muted text-body-alt">
              {selectable && <th className="w-14 px-0 py-3">
                <CellCheckbox checked={allSelected} indeterminate={someSelected && !allSelected} onChange={toggleAll} label="Select all PPLNS work days" />
              </th>}
              {HEADERS.map((header) => (
                <th key={header} className="px-4 py-3 text-left font-normal">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {empty && (
              <tr>
                <td colSpan={4 + Number(selectable)}>
                  <EmptyRow empty={empty} />
                </td>
              </tr>
            )}
            {dailyWork.map((day) => (
              <tr key={day.work_day} className="border-b-[0.5px] border-border">
                {selectable && <td className="w-14 px-0 py-3">
                  <CellCheckbox checked={selected.has(day.work_day)} onChange={() => toggleOne(day.work_day)} label={`Select PPLNS work for ${day.work_day}`} />
                </td>}
                <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">
                  {formatPplnsWorkDay(day.work_day)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-foreground">
                  {formatPplnsDifficulty(day.retained_difficulty)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-foreground">
                  {formatPplnsAverageHashrate(day.retained_difficulty)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-foreground">
                  <BtcAmount sats={day.total_net_sats} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="sm:hidden">
        {selectable && dailyWork.length > 0 && <div className="flex items-center border-b border-border p-3">
          <CellCheckbox checked={allSelected} indeterminate={someSelected && !allSelected} onChange={toggleAll} label="Select all PPLNS work days" />
        </div>}
        {empty && <EmptyRow empty={empty} />}
        {dailyWork.map((day) => (
          <div key={day.work_day}>
            {selectable && <div className="flex items-center px-3 pt-3">
              <CellCheckbox checked={selected.has(day.work_day)} onChange={() => toggleOne(day.work_day)} label={`Select PPLNS work for ${day.work_day}`} />
            </div>}
            <DailyWorkCard day={day} />
          </div>
        ))}
      </div>
    </>
  );
}

function ProjectionBody({
  dailyWork,
  showStats,
  selectable,
  aggregated,
  updateStatus,
}: {
  dailyWork: PplnsProjectionDailyWork[];
  showStats: boolean;
  selectable: boolean;
  aggregated: boolean;
  updateStatus?: ReactNode;
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
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
    <div className="space-y-4">
      <ProjectionHeader aggregated={aggregated} updateStatus={updateStatus}>
        {selectable && dailyWork.length > 0 && <button type="button" disabled={visible.length === 0}
          onClick={() => {
            const checked = visible.filter((day) => selected.has(day.work_day));
            downloadCsv(pplnsDailyWorkToCsv(checked.length ? checked : visible), 'pplns_projection.csv');
          }}
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-info px-5 text-sm text-info-foreground transition-opacity hover:opacity-90 disabled:opacity-40">
          <LiExport className="h-3.5 w-3.5" /> Export CSV
        </button>}
      </ProjectionHeader>
      {showStats && <PplnsProjectionStatCards dailyWork={dailyWork} aggregated={aggregated} />}
      <div className="rounded-xl border border-border bg-card">
        <ProjectionToolbar
          query={query}
          onQuery={setQuery}
          filter={filter}
          onApplyFilter={setFilter}
          onResetFilter={resetFilter}
        />
        <DailyWorkTable dailyWork={visible} empty={empty} selectable={selectable} selected={selected} setSelected={setSelected} />
      </div>
    </div>
  );
}

interface ProjectionPanelProps {
  /** `null` means the cache holds no projection for the latest boundary yet. */
  projection: PplnsProjection | null | undefined;
  isLoading: boolean;
  isError: boolean;
  showStats?: boolean;
  selectable?: boolean;
  dailyWork?: PplnsProjectionDailyWork[] | null;
  aggregated?: boolean;
  updateStatus?: ReactNode;
}

function ProjectionHeader({ aggregated, children, updateStatus }: { aggregated: boolean; children?: ReactNode; updateStatus?: ReactNode }) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="font-heading text-2xl font-semibold leading-9 tracking-[-1px] text-heading">PPLNS projection</h2>
        <p className="mt-1 text-sm text-body-alt">{aggregated ? 'Combined PPLNS work and rewards across all accounts.' : 'Track your retained mining work and projected PPLNS rewards.'}</p>
        {updateStatus && <p className="mt-1 text-xs text-body-alt">{updateStatus}</p>}
      </div>
      {children}
    </header>
  );
}

export function PplnsProjectionPanel(props: ProjectionPanelProps) {
  const rows = props.dailyWork ?? props.projection?.daily_work;
  if (!props.isLoading && !props.isError && props.projection !== null && props.dailyWork !== null && rows) {
    return <ProjectionBody key={props.aggregated ? 'aggregated' : props.projection?.subaccount_id}
      dailyWork={rows} showStats={props.showStats ?? false} selectable={props.selectable ?? true} aggregated={props.aggregated ?? false} updateStatus={props.updateStatus} />;
  }
  return (
    <div className="space-y-4">
      <ProjectionHeader aggregated={props.aggregated ?? false} />
      <ProjectionContent {...props} />
    </div>
  );
}

function ProjectionContent({ projection, dailyWork, isLoading, isError, showStats = false }: ProjectionPanelProps) {
  if (isLoading) {
    if (!showStats) return <div className="h-80 animate-pulse rounded-xl border border-border bg-muted" />;
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-28 animate-pulse border-[0.5px] border-border bg-muted" />
          ))}
        </div>
        <div className="h-80 animate-pulse rounded-xl border border-border bg-muted" />
      </div>
    );
  }
  if (isError) {
    return (
      <StateMessage
        title="Projection could not be loaded"
        body="The dashboard could not load the latest PPLNS projection. Try again shortly."
      />
    );
  }
  if (projection === null || dailyWork === null) {
    return (
      <StateMessage
        title="Projection temporarily unavailable"
        body="No projection is available for the latest PPLNS boundary yet. The cache may still be refreshing; try again shortly."
      />
    );
  }
  return null;
}
