import { useQuery } from '@tanstack/react-query';
import { getDmndClient } from '@/api';
import { useAuth } from '@/auth';
import type { DmndSession, HashrateRange } from '@/api/types';
import { downsampleHashrate, rangeToWindow } from '@/lib/hashrateHistory';
import { fetchConfirmedTxsSince, startOfUtcDaySec, sumOutputsTo } from '@/lib/blockstream';

// The DMND API server data refreshes every 5 minutes (spec cadence), unlike the
// 3s local telemetry. The client already retries transient failures, so the
// queries don't retry on top of it.
const CLOUD_POLL_MS = 5 * 60 * 1000;

// The historical series is dense (~one sample every two minutes); cap the points
// the chart renders so Recharts stays smooth.
const MAX_CHART_POINTS = 300;

// Blockstream is a public third-party API (and this whole path is temporary), so
// today's earnings polls gently and is cached, not on the 5-min cloud cadence.
const EARNINGS_POLL_MS = 15 * 60 * 1000;

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

/**
 * Hashrate time series for the performance chart. The range toggle maps to an
 * RFC3339 from/to window (recomputed each fetch so it slides with "now"), and the
 * dense response is downsampled before it reaches the chart.
 */
export function useAccountHashrateHistory(range: HashrateRange) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['account', 'hashrate-history', range],
    queryFn: async ({ signal }) => {
      const { from, to } = rangeToWindow(range, Date.now());
      const points = await getDmndClient().getHashrateHistory(from, to, { signal });
      return downsampleHashrate(points, MAX_CHART_POINTS);
    },
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

/** Per-worker roster for a date range; used by the workers page. */
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

/** The full worker roster (every page) for the home's Active / Offline counts. */
export function useAccountAllWorkers() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['account', 'workers-all'],
    queryFn: ({ signal }) => getDmndClient().getAllWorkers({ signal }),
    enabled: !!session,
    refetchInterval: CLOUD_POLL_MS,
    staleTime: CLOUD_POLL_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/** The user's own bitcoin (receiving) addresses from the profile (check_auth). */
export function userBitcoinAddresses(profile: DmndSession | undefined): Set<string> {
  const out = new Set<string>();
  const addrs = profile?.bitcoin_addresses;
  if (Array.isArray(addrs)) {
    for (const a of addrs) if (typeof a === 'string' && a) out.add(a);
  } else if (addrs && typeof addrs === 'object') {
    for (const key of Object.keys(addrs)) if (key) out.add(key);
  }
  return out;
}

/**
 * Today's earnings in BTC, from on-chain payouts (temporary: a pool-wallet API will
 * replace Blockstream). The pool's FPPS/PPLNS payout wallets pay the miner's OWN
 * bitcoin address, so we page each payout wallet's confirmed txs newest-first, stop
 * at the first tx older than today (UTC), and sum the outputs paying one of the
 * user's addresses. The payout-address lookup carries the DMND session; the
 * Blockstream calls carry NO DMND auth (different origin). If any wallet fetch
 * fails the query errors so the card shows "--" instead of a false or partial 0; a
 * genuine zero (no payout today) still returns 0.
 */
export function useTodayEarnings() {
  const { session } = useAuth();
  const { data: profile } = useAccountProfile();
  return useQuery({
    queryKey: ['account', 'today-earnings'],
    queryFn: async ({ signal }) => {
      const userAddrs = userBitcoinAddresses(profile);
      if (userAddrs.size === 0) return 0; // no receiving address set -> nothing to receive
      const payout = await getDmndClient().getPayoutAddresses({ signal });
      const wallets = [...new Set([payout.fpps_payout_address, payout.pplns_payout_address].filter(Boolean))];
      if (wallets.length === 0) return 0;
      const since = startOfUtcDaySec(Date.now());
      const perWallet = await Promise.all(
        wallets.map((wallet) =>
          fetchConfirmedTxsSince(wallet, since, { signal }).then((txs) => sumOutputsTo(txs, userAddrs)),
        ),
      );
      const sats = perWallet.reduce((total, s) => total + s, 0);
      return sats / 1e8;
    },
    enabled: !!session && !!profile,
    refetchInterval: EARNINGS_POLL_MS,
    staleTime: EARNINGS_POLL_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
