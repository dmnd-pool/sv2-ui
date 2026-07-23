import { useQuery } from '@tanstack/react-query';
import { getDmndClient } from '@/api';
import { useAuth } from '@/auth';
import type { GeneratedBtcEntry } from '@/api/types';
import { dedupeGeneratedBtc, sortGeneratedByDateDesc } from '@/lib/generatedBtcTable';
import { MAIN_ACCOUNT_LABEL } from '@/lib/payoutsTable';
import { useSubaccountList } from '@/hooks/useSubaccounts';
import { subaccountName } from '@/lib/subaccountsTable';

// Cloud data refreshes every 5 minutes (spec cadence); the client already retries
// transient failures, so the query doesn't retry on top of it.
const CLOUD_POLL_MS = 5 * 60 * 1000;

/**
 * The account's daily generated-BTC entries (GET /api/generated_btc). The endpoint
 * returns a bare array; the client collapses a non-array to []. The Average-hashrate
 * and Active-workers stat cards come from the shared workers roster
 * (`useAccountAllWorkers`), not from this query.
 */
export function useGeneratedBtc() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['account', 'generated-btc'],
    queryFn: ({ signal }): Promise<GeneratedBtcEntry[]> => getDmndClient().getGeneratedBtc({ signal }),
    enabled: !!session,
    refetchInterval: CLOUD_POLL_MS,
    staleTime: CLOUD_POLL_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/**
 * Generated-BTC entries across the main account and every subaccount, each row tagged
 * with the account it belongs to. Each owner has its own dedicated endpoint (unlike
 * Payouts, which scans one shared pool wallet), so this fetches the main account's own
 * entries plus every subaccount's in parallel and tags each result with that owner's
 * name itself — never trusting an embedded field, since `GeneratedBtcEntry` carries
 * none. A failed subaccount fetch rejects the whole query (Promise.all), so the page
 * shows its error state rather than a total that is silently missing an account's BTC.
 *
 * CAVEAT: if `/api/generated_btc` ever included a subaccount's entries under the main
 * account with no way to tell them apart, this would double-count that BTC in the
 * total. Every other per-account endpoint in this API (hashrate, workers) is scoped to
 * the calling account with no such overlap, so this is expected to be scoped the same
 * way, but it could not be confirmed live since the account has zero generated-BTC rows
 * to observe. Revisit once real multi-subaccount BTC data exists.
 */
export function useAggregatedGeneratedBtc(enabled = true) {
  const { session } = useAuth();
  const { data: subs } = useSubaccountList();
  return useQuery({
    queryKey: ['account', 'generated-btc', 'aggregated'],
    queryFn: async ({ signal }): Promise<GeneratedBtcEntry[]> => {
      const client = getDmndClient();
      const owners = subs ?? [];
      const [mainRows, subResults] = await Promise.all([
        client.getGeneratedBtc({ signal }),
        Promise.all(owners.map((s) => client.getSubaccountGeneratedBtc(s.id, s.token, { signal }))),
      ]);
      const tagged: GeneratedBtcEntry[] = [
        ...mainRows.map((r) => ({ ...r, account: MAIN_ACCOUNT_LABEL })),
        ...subResults.flatMap((rows, i) => rows.map((r) => ({ ...r, account: subaccountName(owners[i]) }))),
      ];
      return sortGeneratedByDateDesc(dedupeGeneratedBtc(tagged));
    },
    enabled: enabled && !!session && subs !== undefined,
    refetchInterval: CLOUD_POLL_MS,
    staleTime: CLOUD_POLL_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
