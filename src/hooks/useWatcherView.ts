import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createWatcherClient } from '@/api/watcherClient';
import type { HashrateRange } from '@/api/types';
import { rangeToWindow } from '@/lib/hashrateHistory';

// The public view polls a little slower than the owner's dashboard; it is a shared,
// read-only page and does not need second-by-second freshness.
const WATCHER_POLL_MS = 60 * 1000;

/** A memoised token-only client for one watcher token. */
function useClient(token: string) {
  return useMemo(() => createWatcherClient(token), [token]);
}

/** Live hashrate snapshot for the watcher token (null-safe; gated on hashrate scope by the caller). */
export function useWatcherHashrate(token: string) {
  const client = useClient(token);
  return useQuery({
    queryKey: ['watcher', token, 'hashrate'],
    queryFn: ({ signal }) => client.getHashrate(signal),
    refetchInterval: WATCHER_POLL_MS,
    staleTime: WATCHER_POLL_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/** An explicit chart window (ms epoch) for the Custom range. */
export interface CustomWindow {
  fromMs: number;
  toMs: number;
}

/**
 * Historical hashrate series for the chart. When `custom` is set it takes precedence
 * over the preset range (the Custom calendar selection); otherwise the preset maps to a
 * rolling window ending now.
 */
export function useWatcherHashrateHistory(token: string, range: HashrateRange, custom?: CustomWindow | null) {
  const client = useClient(token);
  return useQuery({
    queryKey: ['watcher', token, 'history', custom ? `custom:${custom.fromMs}-${custom.toMs}` : range],
    queryFn: ({ signal }) => {
      const { from, to } = custom
        ? { from: new Date(custom.fromMs).toISOString(), to: new Date(custom.toMs).toISOString() }
        : rangeToWindow(range, Date.now());
      return client.getHashrateHistory(from, to, signal);
    },
    staleTime: WATCHER_POLL_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/** The worker roster for the watcher token (gated on workers scope by the caller). */
export function useWatcherWorkers(token: string) {
  const client = useClient(token);
  return useQuery({
    queryKey: ['watcher', token, 'workers'],
    queryFn: ({ signal }) => client.getWorkers(signal).then((r) => r.workers),
    refetchInterval: WATCHER_POLL_MS,
    staleTime: WATCHER_POLL_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/** Daily generated-BTC entries for the watcher token (gated on the earnings scope). */
export function useWatcherGeneratedBtc(token: string, enabled: boolean) {
  const client = useClient(token);
  return useQuery({
    queryKey: ['watcher', token, 'generated-btc'],
    queryFn: ({ signal }) => client.getGeneratedBtc(signal),
    enabled,
    staleTime: WATCHER_POLL_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/** Current pool + broker fee rates for the watcher token (gated on the fees scope). */
export function useWatcherFees(token: string, enabled: boolean) {
  const client = useClient(token);
  return useQuery({
    queryKey: ['watcher', token, 'fees'],
    queryFn: ({ signal }) => client.getFees(signal),
    enabled,
    staleTime: WATCHER_POLL_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
