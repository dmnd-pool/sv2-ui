import { useQuery } from '@tanstack/react-query';
import { getDmndClient } from '@/api';
import { useAuth } from '@/auth';
import type { HashrateRange } from '@/api/types';

// The DMND cloud data refreshes every 5 minutes (spec cadence), unlike the 3s
// local telemetry. The client already retries transient failures, so the queries
// don't retry on top of it.
const CLOUD_POLL_MS = 5 * 60 * 1000;

/** Live hashrate snapshot for the signed-in account (home live-hashrate card). */
export function useAccountHashrate() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['account', 'hashrate'],
    queryFn: ({ signal }) => getDmndClient().getHashrate({ signal }),
    enabled: !!session,
    refetchInterval: CLOUD_POLL_MS,
    staleTime: CLOUD_POLL_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/** Hashrate time series for the performance chart, by range. */
export function useAccountHashrateHistory(range: HashrateRange) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['account', 'hashrate-history', range],
    queryFn: ({ signal }) => getDmndClient().getHashrateHistory(range, { signal }),
    enabled: !!session,
    refetchInterval: CLOUD_POLL_MS,
    staleTime: CLOUD_POLL_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/**
 * Full account profile (checkAuth): the pool tokens for the connect-workers card
 * and the 2FA / payout state for the getting-started checklist. These values are
 * stable, so it's fetched once and not polled.
 */
export function useAccountProfile() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['account', 'profile'],
    queryFn: ({ signal }) => getDmndClient().checkAuth({ signal }),
    enabled: !!session,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/** Worker roster for a date range; feeds the Active / Offline / Rejection cards. */
export function useAccountWorkers(from: string, to: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['account', 'workers', from, to],
    queryFn: ({ signal }) => getDmndClient().getWorkers(from, to, { signal }),
    enabled: !!session && !!from && !!to,
    refetchInterval: CLOUD_POLL_MS,
    staleTime: CLOUD_POLL_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
