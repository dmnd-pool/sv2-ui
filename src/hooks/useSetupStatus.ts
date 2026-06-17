import { useQuery } from '@tanstack/react-query';

export interface SetupStatus {
  configured: boolean;
  running: boolean;
  miningMode: 'solo' | 'pool' | null;
  mode: 'jd' | 'no-jd' | null;
  poolName: string | null;
  containers: {
    translator: { id: string; name: string; status: string } | null;
    jdc: { id: string; name: string; status: string } | null;
  };
}

/**
 * Fetch setup status from the backend.
 * Returns null if backend is not available (standalone mode).
 */
async function fetchSetupStatus(): Promise<SetupStatus | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    const response = await fetch('/api/status', {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch {
    // Backend not available - standalone mode
    return null;
  }
}

/**
 * Hook to check setup status.
 * 
 * Returns:
 * - isOrchestrated: true if running with orchestration backend
 * - isConfigured: true if setup has been completed
 * - isRunning: true if containers are running
 * - needsSetup: true if user should be redirected to /setup
 */
export function useSetupStatus() {
  const query = useQuery({
    queryKey: ['setup-status'],
    queryFn: fetchSetupStatus,
    staleTime: 10000,
    refetchInterval: 10000,
    retry: false,
  });

  const status = query.data;

  // Loading is the FIRST load only. `isFetched` flips true after the first
  // settle and stays true, so background refetches (refetchInterval) never flip
  // this back to true. Without this, every 10s refetch re-entered the caller's
  // loading branch, which on a page without the backend (e.g. the hosted
  // preview) remounted the whole authed subtree and wiped in-progress form
  // input. isFetched survives refetches.
  const isLoading = query.isLoading && !query.isFetched;

  return {
    isLoading,
    isError: query.isError,
    // If status is null or undefined, we're in standalone mode (no backend)
    isOrchestrated: status !== null && status !== undefined,
    isConfigured: status?.configured ?? false,
    isRunning: status?.running ?? false,
    miningMode: status?.miningMode ?? null,
    mode: status?.mode ?? null,
    poolName: status?.poolName ?? null,
    containers: status?.containers ?? { translator: null, jdc: null },
    // User needs setup if: orchestrated mode AND not yet configured
    needsSetup: status !== null && status !== undefined && !status.configured,
    refetch: query.refetch,
  };
}
