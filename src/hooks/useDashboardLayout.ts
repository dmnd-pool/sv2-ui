import { useCallback, useEffect, useState } from 'react';
import {
  moveWidget,
  normalizeLayout,
  reorderWidget,
  toggleWidget,
  type DashboardLayout,
  type WidgetId,
} from '@/lib/dashboardLayout';

const STORAGE_KEY = 'dmnd.dashboard.layout';

function read(): DashboardLayout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return normalizeLayout(raw ? JSON.parse(raw) : null);
  } catch {
    return normalizeLayout(null);
  }
}

/**
 * The home dashboard layout (widget order + hidden set), persisted per browser and
 * always normalized so a stale stored value can never render a broken dashboard.
 * Mirrors the useTheme localStorage pattern.
 */
export function useDashboardLayout() {
  const [layout, setLayout] = useState<DashboardLayout>(() =>
    typeof window === 'undefined' ? normalizeLayout(null) : read(),
  );

  const persist = useCallback((next: DashboardLayout) => {
    setLayout(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore storage failures; the layout still applies for this session */
    }
  }, []);

  // Keep other tabs in sync when the layout changes elsewhere.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setLayout(read());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return {
    layout,
    toggle: (id: WidgetId) => persist(toggleWidget(layout, id)),
    move: (id: WidgetId, dir: 'up' | 'down') => persist(moveWidget(layout, id, dir)),
    reorder: (id: WidgetId, toIndex: number) => persist(reorderWidget(layout, id, toIndex)),
    reset: () => persist(normalizeLayout(null)),
  };
}
