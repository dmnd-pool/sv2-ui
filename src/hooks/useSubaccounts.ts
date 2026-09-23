import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getUser } from '@/api';
import { useAuth } from '@/auth';
import type { CreateSubaccountInput } from '@/api/types';
import { enrichSubaccount, type EnrichedSubaccount } from '@/lib/subaccountsTable';
import { useActiveAccountId } from './useActiveAccountId';
import { msUntilNextTick } from '@/lib/utils';

// The UI checks every five minutes
const CLOUD_POLL_MS = 5 * 60 * 1000;

/**
 * The account's subaccounts, each enriched with its summary (rejection + today's
 * earnings in one response) and worker roster (active/offline counts, which the
 * summary does not carry). A failed sub-call rejects the whole query so the page
 * shows its error state, rather than silently reporting 0 workers or 0 earnings for
 * a row whose data could not be read (a misleading figure on money data).
 */
export function useSubaccounts(enabled = true) {
  const { session } = useAuth();
  const ownerAccountId = session?.accountId ?? null;
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['account', 'subaccounts', ownerAccountId],
    queryFn: async ({ signal }): Promise<EnrichedSubaccount[]> => {
      const client = getUser();
      const requestOptions = { signal, accountId: ownerAccountId ?? undefined };
      // Share the lightweight list cache used by the account switcher, aggregate
      // chart, and filters instead of issuing a second identical list request.
      const list = await queryClient.fetchQuery({
        queryKey: ['account', 'subaccounts', 'list', ownerAccountId],
        queryFn: ({ signal: listSignal }) => client.getSubaccounts({
          signal: listSignal,
          accountId: ownerAccountId ?? undefined,
        }),
        staleTime: CLOUD_POLL_MS,
      });
      return Promise.all(
        list.map(async (row) => {
          const [summary, workersRes] = await Promise.all([
            client.getSubaccountSummary(row.id, requestOptions),
            client.getSubaccountWorkers(row.id, requestOptions),
          ]);
          return enrichSubaccount(row, summary, workersRes.workers);
        }),
      );
    },
    enabled: !!session && enabled,
    refetchInterval: () => msUntilNextTick(CLOUD_POLL_MS),
    staleTime: CLOUD_POLL_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/**
 * The raw subaccount rows, without the per-row enrichment calls. Callers that only
 * need to map an id to a name (rather than render the subaccounts table) use this so
 * they cost one request instead of two per subaccount, and so an enrichment failure
 * cannot take their page down with it.
 */
export function useSubaccountList() {
  const { session } = useAuth();
  const ownerAccountId = session?.accountId ?? null;
  return useQuery({
    queryKey: ['account', 'subaccounts', 'list', ownerAccountId],
    queryFn: ({ signal }) =>
      getUser().getSubaccounts({ signal, accountId: ownerAccountId ?? undefined }),
    enabled: !!session,
    staleTime: CLOUD_POLL_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/**
 * Whether the account has any subaccounts, from the list endpoint alone, sharing
 * useSubaccountList's cache (no separate query). Kept separate from useSubaccounts so
 * gating UI (the aggregated-mode toggle) never triggers the heavy per-sub fan-out on
 * a page that only needs the count.
 */
export function useHasSubaccounts() {
  const query = useSubaccountList();
  return { hasSubaccounts: (query.data?.length ?? 0) > 0, isLoading: query.isLoading };
}

/**
 * Capability flags for the account. Stable for a session, so fetched once and not
 * polled; gates the Create button (create_sub_account) and page (view_sub_accounts).
 */
export function usePermissions() {
  const { session } = useAuth();
  const accountId = useActiveAccountId();
  return useQuery({
    queryKey: ['account', 'permissions', accountId],
    queryFn: ({ signal }) => getUser().getPermissions({ signal, accountId: accountId ?? undefined }),
    enabled: !!session,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/** Create a subaccount, then refresh the list so the new row appears. */
export function useCreateSubaccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSubaccountInput) => getUser().createSubaccount(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['account', 'subaccounts'] }),
  });
}
