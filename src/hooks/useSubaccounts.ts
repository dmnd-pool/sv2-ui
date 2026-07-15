import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getDmndClient } from '@/api';
import { useAuth } from '@/auth';
import type { CreateSubaccountInput } from '@/api/types';
import { enrichSubaccount, type EnrichedSubaccount } from '@/lib/subaccountsTable';

// Cloud data refreshes every 5 minutes (spec cadence); the client already retries
// transient failures, so the queries don't retry on top of it.
const CLOUD_POLL_MS = 5 * 60 * 1000;

/**
 * The account's subaccounts, each enriched with its summary (rejection + today's
 * earnings in one response) and worker roster (active/offline counts, which the
 * summary does not carry). A failed sub-call rejects the whole query so the page
 * shows its error state, rather than silently reporting 0 workers or 0 earnings for
 * a row whose data could not be read (a misleading figure on money data).
 */
export function useSubaccounts() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['account', 'subaccounts'],
    queryFn: async ({ signal }): Promise<EnrichedSubaccount[]> => {
      const client = getDmndClient();
      const list = await client.getSubaccounts({ signal });
      const now = Date.now();
      return Promise.all(
        list.map(async (row) => {
          const token = row.token ?? '';
          const [summary, workersRes] = await Promise.all([
            client.getSubaccountSummary(row.id, token, { signal }),
            client.getSubaccountWorkers(row.id, token, { signal }),
          ]);
          return enrichSubaccount(row, summary, workersRes.workers, now);
        }),
      );
    },
    enabled: !!session,
    refetchInterval: CLOUD_POLL_MS,
    staleTime: CLOUD_POLL_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/**
 * Capability flags for the account. Stable for a session, so fetched once and not
 * polled; gates the Create button (create_sub_account) and page (view_sub_accounts).
 */
export function usePermissions() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['account', 'permissions'],
    queryFn: ({ signal }) => getDmndClient().getPermissions({ signal }),
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
    mutationFn: (input: CreateSubaccountInput) => getDmndClient().createSubaccount(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['account', 'subaccounts'] }),
  });
}
