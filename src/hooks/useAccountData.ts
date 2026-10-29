import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { getUser } from '@/api';
import { useAuth } from '@/auth';
import type { DmndSession, HashrateRange, DmndClient, Worker } from '@/api/types';
import { cachedHashrateHistory, downsampleHashrate, rangeToWindow } from '@/lib/hashrateHistory';
import { mapConcurrent } from '@/lib/concurrency';
import { sumHashrateSeries } from '@/lib/aggregatedHashrate';
import { useSubaccountList, ACCOUNT_POLL_MS } from './useSubaccounts';
import { useActiveAccountId } from './useActiveAccountId';
import { msUntilNextTick } from '@/lib/utils';
import { accountPayoutQueryOptions, latestPayout, payoutFromApi } from '@/lib/payoutsTable';

// The UI checks account data every five minutes.
const CLOUD_POLL_MS = 5 * 60 * 1000;

// The historical series is dense (~one sample every two minutes); cap the points
// the chart renders so Recharts stays smooth.
const MAX_CHART_POINTS = 300;

/** Live hashrate snapshot for the signed-in account (home live-hashrate card). */
export function useAccountHashrate(enabled = true) {
  const { session } = useAuth();
  const accountId = useActiveAccountId();
  return useQuery({
    queryKey: ['account', 'hashrate', accountId],
    queryFn: ({ signal }) => getUser().getHashrate({ signal, accountId: accountId ?? undefined }),
    enabled: !!session && enabled,
    refetchInterval: () => msUntilNextTick(CLOUD_POLL_MS),
    staleTime: CLOUD_POLL_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/** A summary supplies today's FPPS generation, share counts and rates in one read. */
export function accountSummaryQueryOptions(client: DmndClient, ownerId: string | null, accountId: string | null) {
  return {
    queryKey: ['account', 'subaccount-summary', ownerId, accountId],
    queryFn: ({ signal }: { signal: AbortSignal }) => client.getSubaccountSummary(accountId!, { signal, accountId: ownerId! }),
    staleTime: CLOUD_POLL_MS,
    refetchInterval: () => msUntilNextTick(CLOUD_POLL_MS),
    refetchOnWindowFocus: false,
    retry: false,
  } as const;
}

export function useAccountSummary(enabled = true) {
  const { session } = useAuth();
  const accountId = useActiveAccountId();
  return useQuery({
    ...accountSummaryQueryOptions(getUser(), session?.accountId ?? null, accountId),
    enabled: enabled && !!session && !!accountId,
  });
}

/**
 * Hashrate time series for the performance chart. The range toggle maps to an
 * RFC3339 from/to window (recomputed each fetch so it slides with "now"), and the
 * dense response is downsampled before it reaches the chart.
 */
export function useAccountHashrateHistory(
  range: HashrateRange,
  custom?: { from: string; to: string } | null,
  enabled = true,
) {
  const { session } = useAuth();
  const accountId = useActiveAccountId();
  // A custom window is a fixed span, so it does not slide with "now" and its key is
  // the explicit from/to; a preset recomputes its window on each fetch.
  const key = custom ? `custom:${custom.from}:${custom.to}` : range;
  const cache = useQueryClient();
  return useQuery({
    queryKey: ['account', 'hashrate-history', key, accountId],
    queryFn: async () => {
      const window = custom ?? rangeToWindow(range, Date.now());
      const points = await cachedHashrateHistory(cache, ['account', 'hashrate-history-raw', key, accountId], window,
        (from, to, signal) => getUser().getHashrateHistory(from, to, { signal, accountId: accountId! }), !!custom);
      return downsampleHashrate(points, MAX_CHART_POINTS);
    },
    enabled: !!session && enabled,
    // A custom (historical) window doesn't need polling; presets stay live.
    refetchInterval: custom ? false : () => msUntilNextTick(CLOUD_POLL_MS),
    staleTime: CLOUD_POLL_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/**
 * Full account profile (checkAuth): the pool tokens for the connect-workers card
 * and the 2FA / payout state for the getting-started checklist. These values are
 * mostly stable. While KYB is under review, refresh it with the rest of the account
 * data so the status can update without requiring a reload.
 */
export function useAccountProfile() {
  const { session } = useAuth();
  const accountId = useActiveAccountId();
  return useQuery({
    queryKey: ['account', 'profile', accountId],
    queryFn: ({ signal }) => getUser().checkAuth({ signal, accountId: accountId ?? undefined }),
    enabled: !!session,
    staleTime: CLOUD_POLL_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/**
 * The combined hashrate series across the main account and every subaccount, for the
 * chart in aggregated mode. Every account is fetched over the same window in raw H/s and
 * the readings sharing a timestamp are added. A failed account rejects the query so the
 * chart shows its error state rather than a line that silently omits an account.
 */
export function useAggregatedHashrateHistory(
  range: HashrateRange,
  custom?: { from: string; to: string } | null,
  enabled = true,
) {
  const { session } = useAuth();
  const ownerAccountId = session?.accountId ?? null;
  const { data: subs } = useSubaccountList();
  const queryClient = useQueryClient();
  const key = custom ? `custom:${custom.from}:${custom.to}` : range;
  return useQuery({
    queryKey: ['account', 'hashrate-history', 'aggregated', key, ownerAccountId, subs?.map((sub) => sub.id)],
    queryFn: async ({ signal }) => {
      const owners = subs ?? [];
      const window = custom ?? rangeToWindow(range, Date.now());
      const client = getUser();
      const ownerProfile = queryClient.fetchQuery({
        queryKey: ['account', 'profile', ownerAccountId],
        queryFn: ({ signal: profileSignal }) => client.checkAuth({
          signal: profileSignal,
          accountId: ownerAccountId ?? undefined,
        }),
        // The mining credentials used for delegation are stable for the login.
        // Explicit profile invalidation still refreshes this cache when settings change.
        staleTime: Infinity,
        retry: false,
      });
      const [mainPoints, subSeries] = await Promise.all([
        cachedHashrateHistory(queryClient, ['account', 'hashrate-history-raw', key, ownerAccountId], window,
          (from, to, signal) => client.getHashrateHistory(from, to, { signal, accountId: ownerAccountId! }), !!custom),
        ownerProfile.then((profile) => mapConcurrent(owners, (s) => {
          signal.throwIfAborted();
          return cachedHashrateHistory(queryClient, ['account', 'hashrate-history-raw', key, s.id], window,
            (from, to, signal) => client.getSubaccountHashrateHistory(s.id, from, to, profile.token, s.token, { signal, accountId: ownerAccountId! }), !!custom);
        })),
      ]);
      return downsampleHashrate(sumHashrateSeries([mainPoints, ...subSeries]), MAX_CHART_POINTS);
    },
    enabled: !!session && enabled && subs !== undefined,
    refetchInterval: custom ? false : () => msUntilNextTick(CLOUD_POLL_MS),
    staleTime: CLOUD_POLL_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/**
 * The account's own 24h share counts. The single-account home and aggregated roll-up
 * both use this endpoint so rejection rate always has the same explicit time window.
 */
export function useAccountShareStats(enabled = true) {
  const { session } = useAuth();
  const accountId = useActiveAccountId();
  return useQuery({
    queryKey: ['account', 'share-stats', accountId],
    queryFn: ({ signal }) => getUser().getShareStats({ signal, accountId: accountId ?? undefined }),
    enabled: !!session && enabled,
    refetchInterval: () => msUntilNextTick(CLOUD_POLL_MS),
    staleTime: CLOUD_POLL_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/** The full worker roster (every page) for the active account. */
export function useAccountAllWorkers(enabled = true) {
  const { session } = useAuth();
  const accountId = useActiveAccountId();
  return useQuery({
    queryKey: ['account', 'workers-all', accountId],
    queryFn: ({ signal }) => getUser().getAllWorkers({ signal, accountId: accountId ?? undefined }),
    enabled: !!session && enabled,
    refetchInterval: () => msUntilNextTick(CLOUD_POLL_MS),
    staleTime: CLOUD_POLL_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/**
 * All the user's bitcoin addresses
 */
export function userBitcoinAddresses(profile: DmndSession | undefined): Set<string> {
  return new Set(Object.keys(profile?.bitcoin_addresses ?? {}).filter(Boolean));
}

/** Stable query-key fragment for data whose client-side ownership filter uses these addresses. */
export function userBitcoinAddressesKey(profile: DmndSession | undefined): string {
  return JSON.stringify([...userBitcoinAddresses(profile)].sort());
}

export function activeBitcoinAddress(profile: DmndSession | undefined): string | null {
  const active = Object.entries(profile?.bitcoin_addresses ?? {}).find(([address, isActive]) => isActive && address);
  return active?.[0] ?? null;
}

/**
 * Latest confirmed payout transaction. Single mode uses the exact account endpoint;
 * aggregated mode reads the complete account tree once, avoiding duplicate shared-address outputs.
 */
export function useLatestPayout(enabled = true, aggregated = false) {
  const { session } = useAuth();
  const ownerAccountId = session?.accountId ?? null;
  const accountId = useActiveAccountId();
  return useQuery({
    ...accountPayoutQueryOptions(getUser(), ownerAccountId, accountId, aggregated),
    select: (records) => latestPayout(records.map(payoutFromApi)),
    enabled: enabled && !!session && !!accountId,
  });
}

/** Setup needs worker existence, reusing a full roster when another widget loads it. */
export function workerPresenceQueryOptions(cache: QueryClient, client: DmndClient, accountId: string | null) {
  return {
    queryKey: ['account', 'worker-presence', accountId],
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      const key = ['account', 'workers-all', accountId];
      const cached = cache.getQueryData<Worker[]>(key);
      if (cached && cached.length > 0) return true;
      const updatedAt = cache.getQueryState(key)?.dataUpdatedAt ?? 0;
      if (cached !== undefined && Date.now() - updatedAt < ACCOUNT_POLL_MS) return false;
      if (cache.getQueryState(key)?.fetchStatus === 'fetching') {
        const workers = await cache.fetchQuery<Worker[]>({ queryKey: key, staleTime: ACCOUNT_POLL_MS, retry: false });
        return workers.length > 0;
      }
      return client.hasWorkers({ signal, accountId: accountId! });
    },
    staleTime: (query: { state: { data: unknown } }) => query.state.data === true ? Infinity : ACCOUNT_POLL_MS,
    refetchInterval: (query: { state: { data: unknown } }) => query.state.data === true ? false as const : msUntilNextTick(ACCOUNT_POLL_MS),
    gcTime: 60 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  };
}

export const BLOG_URL = 'https://blog.dmnd.work/';

// Public, read-only Ghost Content API key published by the blog's own theme.
// This is not a Ghost Admin API key or a dashboard credential.
const CONTENT_API = 'https://dmnd.ghost.io/ghost/api/content/posts/';
const CONTENT_KEY = '123895ea550e80b78a314ed590';

export interface LatestBlogPost {
  title: string;
  url: string;
  image: string | null;
}

/** One attempt per login, shared by login prefetch and Help. */
export function latestBlogQueryOptions(accountId: string, loginId: string | number) {
  return {
    queryKey: ['blog', 'latest-post', accountId, loginId],
    queryFn: ({ signal }: { signal: AbortSignal }) => fetchLatestBlogPost(signal),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    retryOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  } as const;
}

export async function fetchLatestBlogPost(signal?: AbortSignal, fetchImpl = fetch): Promise<LatestBlogPost | null> {
  const url = new URL(CONTENT_API);
  url.search = new URLSearchParams({
    key: CONTENT_KEY, limit: '1', order: 'published_at desc', fields: 'title,url,feature_image',
  }).toString();
  const response = await fetchImpl(url, { signal, credentials: 'omit' });
  if (!response.ok) throw new Error('Unable to load the latest blog post.');
  const data = await response.json();
  const post = data.posts?.[0];
  if (!post) return null;
  if (typeof post.title !== 'string' || typeof post.url !== 'string' || new URL(post.url).origin !== new URL(BLOG_URL).origin) {
    throw new Error('Invalid blog post.');
  }
  const image = typeof post.feature_image === 'string' && post.feature_image.startsWith('https://') ? post.feature_image : null;
  return { title: post.title, url: post.url, image };
}
