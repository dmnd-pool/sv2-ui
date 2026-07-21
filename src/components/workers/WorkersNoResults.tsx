import { BdRoundedMagnifer, BdSort } from 'solar-icon-react/bd';

/**
 * Shown inside the workers card when workers exist but the active search or filter
 * matches none of them. Two variants: the filter variant offers a Clear filters
 * action, the search variant points the miner at their search box instead.
 */
export function WorkersNoResults({ mode, onClear }: { mode: 'search' | 'filter'; onClear: () => void }) {
  const search = mode === 'search';
  const Icon = search ? BdRoundedMagnifer : BdSort;

  return (
    <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
      <Icon className="h-12 w-12 text-placeholder" />
      <p className="text-lg font-medium text-foreground">
        {search ? 'No workers found' : 'No workers match this filter'}
      </p>
      <p className="max-w-sm text-sm text-body-alt">
        {search ? 'Try a different worker name or clear your search.' : 'Adjust or clear your filters.'}
      </p>
      {!search && (
        <button
          type="button"
          onClick={onClear}
          className="mt-2 inline-flex items-center rounded-full border border-black/20 bg-muted px-5 py-2 text-sm text-foreground transition-colors hover:bg-border"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
