import { useCallback, useEffect, useMemo, useState } from 'react';
import { AGG_STORAGE_KEY, readAggregated } from '@/lib/aggregatedMode';

function read(): boolean {
  try {
    return readAggregated(localStorage.getItem(AGG_STORAGE_KEY));
  } catch {
    return false;
  }
}

/**
 * The aggregated-dashboard flag, persisted per browser and synced across tabs.
 * Mirrors the useDashboardLayout localStorage pattern. This hook only owns the
 * stored preference; whether the toggle is available (main account + has
 * subaccounts) is decided by the caller, so the flag can persist while a miner is
 * temporarily viewing a single subaccount.
 */
export function useAggregatedMode() {
  const [aggregated, setAggregatedState] = useState<boolean>(() =>
    typeof window === 'undefined' ? false : read(),
  );

  const setAggregated = useCallback((next: boolean) => {
    setAggregatedState(next);
    try {
      localStorage.setItem(AGG_STORAGE_KEY, next ? 'true' : 'false');
    } catch {
      /* ignore storage failures; the flag still applies for this session */
    }
  }, []);

  // Keep other tabs in sync when the flag changes elsewhere.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === AGG_STORAGE_KEY) setAggregatedState(read());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Stable object so context consumers only re-render when the flag itself changes.
  return useMemo(() => ({ aggregated, setAggregated }), [aggregated, setAggregated]);
}
