import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { getUser } from '@/api';
import type { DmndClient } from '@/api';
import { useActiveAccountId } from './useActiveAccountId';
import { useAuth } from '@/auth';
import { useSubaccountList } from './useSubaccounts';
import { combinePplnsDailyWork } from '@/lib/pplnsProjection';
import { useAggregatedModeContext } from './AggregatedModeProvider';
import { mapConcurrent } from '@/lib/concurrency';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export class PplnsReportUnavailableError extends Error {
  constructor() {
    super('The PPLNS report is being updated.');
    this.name = 'PplnsReportUnavailableError';
  }
}

const reportQueryPolicy = {
  staleTime: REFRESH_INTERVAL_MS,
  refetchInterval: (query: { state: { error: unknown } }) =>
    query.state.error instanceof PplnsReportUnavailableError ? 15_000 : REFRESH_INTERVAL_MS,
  refetchOnWindowFocus: false,
  retry: (failureCount: number, error: unknown) => error instanceof PplnsReportUnavailableError && failureCount < 2,
  retryDelay: 5_000,
} as const;

export function pplnsProjectionQueryOptions(client: DmndClient, accountId: string | null, requestAccountId = accountId) {
  return {
    queryKey: ['account', 'pplns-projection', accountId],
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      if (!accountId) throw new Error('No account');
      const projection = await client.getPplnsProjection(accountId, { signal, accountId: requestAccountId ?? accountId });
      if (projection === null) throw new PplnsReportUnavailableError();
      return projection;
    },
    ...reportQueryPolicy,
  } as const;
}

export function usePplnsProjection(enabled = true) {
  const accountId = useActiveAccountId();
  return useQuery({
    ...pplnsProjectionQueryOptions(getUser(), accountId),
    enabled: enabled && !!accountId,
  });
}

/** Publish a combined report only when every account has a successful response. */
export async function loadAggregatedPplnsDailyWork(
  cache: QueryClient, client: DmndClient, ownerId: string, accountIds: string[], signal: AbortSignal,
) {
  const projections = await mapConcurrent(accountIds, (id) => {
    signal.throwIfAborted();
    return cache.fetchQuery({
      ...pplnsProjectionQueryOptions(client, id, ownerId),
      // Individual reads are shared with the single-account view. Cancelling the
      // aggregate must not abort another consumer's request.
      // Retry the combined read as a unit rather than multiplying per-account retries.
      retry: false,
    });
  });
  return combinePplnsDailyWork(projections.map((projection) => projection.daily_work));
}

export function aggregatedPplnsProjectionQueryOptions(
  cache: QueryClient, client: DmndClient, ownerId: string, accountIds: string[],
) {
  return {
    queryKey: ['account', 'pplns-projection', 'aggregated', ownerId, accountIds],
    queryFn: ({ signal }: { signal: AbortSignal }) => loadAggregatedPplnsDailyWork(cache, client, ownerId, accountIds, signal),
    ...reportQueryPolicy,
  } as const;
}

export function useAggregatedPplnsProjection(enabled = true) {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const { data: subs } = useSubaccountList();
  const ownerId = session?.accountId;
  const accountIds = [...new Set([ownerId, ...(subs ?? []).map((sub) => sub.id)].filter((id): id is string => !!id))].sort();
  return useQuery({
    ...aggregatedPplnsProjectionQueryOptions(queryClient, getUser(), ownerId!, accountIds),
    enabled: enabled && !!session && subs !== undefined,
  });
}

/** Shared eligibility for navigation and direct routes, scoped to the account in view. */
export function usePplnsReportAvailability() {
  const { aggregated } = useAggregatedModeContext();
  const single = usePplnsProjection(!aggregated);
  const combined = useAggregatedPplnsProjection(aggregated);
  const query = aggregated ? combined : single;
  const rows = aggregated ? combined.data : single.data?.daily_work;
  return {
    hasReport: (rows?.length ?? 0) > 0,
    // An empty cached report may be stale. Let its refresh finish before the
    // route guard decides that this account has no report.
    isLoading: query.isPending || query.isFetching || query.error instanceof PplnsReportUnavailableError,
    isError: query.isError && !(query.error instanceof PplnsReportUnavailableError),
    refetch: () => query.refetch(),
  };
}
