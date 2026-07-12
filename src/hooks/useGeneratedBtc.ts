import { useQuery } from '@tanstack/react-query';
import { getDmndClient } from '@/api';
import { useAuth } from '@/auth';
import type { GeneratedBtcEntry } from '@/api/types';

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
