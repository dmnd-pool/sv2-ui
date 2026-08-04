import { useRef, useState, type ReactNode } from 'react';
import { GripVertical } from 'lucide-react';
import { LiTuning4, LiRouting2 } from 'solar-icon-react/li';
import { LiveHashrateCard } from '@/components/home/LiveHashrateCard';
import { ConnectWorkersCard } from '@/components/home/ConnectWorkersCard';
import { WorkerStatCards } from '@/components/home/WorkerStatCards';
import { MiningPerformanceChart } from '@/components/home/MiningPerformanceChart';
import { GettingStartedCard } from '@/components/home/GettingStartedCard';
import { CustomizeDashboardPanel } from '@/components/home/CustomizeDashboardPanel';
import { useToast } from '@/components/ui/toast';
import { CombinedHashrateCard } from '@/components/home/CombinedHashrateCard';
import { useAggregatedModeContext } from '@/hooks/AggregatedModeProvider';
import { useAggregatedData } from '@/hooks/useAggregatedData';
import type { AggregatedStats } from '@/lib/aggregatedStats';
import { ProductTour } from '@/components/home/ProductTour';
import { useDashboardLayout } from '@/hooks/useDashboardLayout';
import { visibleInOrder, type WidgetId } from '@/lib/dashboardLayout';
import { cn } from '@/lib/utils';

interface DragState {
  dragId: WidgetId | null;
  overId: WidgetId | null;
  onDragStart: (id: WidgetId) => void;
  onDragOverId: (id: WidgetId) => void;
  onDrop: () => void;
  onDragEnd: () => void;
}

/** The widget body wrapped so a grip handle overlays it and it becomes draggable in customize mode. */
function WidgetShell({
  id,
  customizing,
  drag,
  tour,
  children,
  className,
}: {
  id: WidgetId;
  customizing: boolean;
  drag: DragState;
  tour?: string;
  children: ReactNode;
  className?: string;
}) {
  const isOver = customizing && drag.overId === id && drag.dragId !== id;
  return (
    <div
      data-tour={tour}
      className={cn(
        'relative transition-transform',
        className,
        // A dragged widget keeps its fill and border; it lifts and tilts instead of fading.
        drag.dragId === id && 'rotate-[1.54deg] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)]',
      )}
      draggable={customizing}
      onDragStart={() => drag.onDragStart(id)}
      onDragOver={(e) => {
        if (!customizing) return;
        e.preventDefault();
        drag.onDragOverId(id);
      }}
      onDrop={(e) => {
        if (!customizing) return;
        e.preventDefault();
        drag.onDrop();
      }}
      onDragEnd={drag.onDragEnd}
    >
      {customizing && (
        <span
          aria-hidden
          className="absolute left-3 top-3 z-10 flex h-4 w-4 cursor-grab items-center justify-center text-[#525252] active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </span>
      )}
      {/* The design marks the drop slot with an empty dashed placeholder over the widget. */}
      {isOver && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10 border-[0.5px] border-dashed border-[#737373] bg-secondary"
        />
      )}
      {children}
    </div>
  );
}

/** Live hashrate + connect-workers side by side (3:2), used when they're adjacent. */
function HashrateConnectRow({ customizing, drag }: { customizing: boolean; drag: DragState }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <WidgetShell id="hashrate" customizing={customizing} drag={drag} tour="hashrate" className="lg:col-span-3">
        <LiveHashrateCard />
      </WidgetShell>
      <WidgetShell id="connect" customizing={customizing} drag={drag} className="lg:col-span-2">
        <ConnectWorkersCard />
      </WidgetShell>
    </div>
  );
}

/**
 * The header's secondary buttons: hairline-bordered pill on the secondary fill, at
 * regular weight. Shared so the two never drift apart.
 */
const HEADER_BUTTON =
  'inline-flex items-center gap-2 rounded-[32px] border-[0.5px] border-black/20 bg-btn-secondary px-5 py-2 text-sm leading-5 text-foreground transition-colors hover:bg-muted';

/** One widget rendered full-width (used when it isn't part of the hashrate/connect pair). */
function widgetBlock(
  id: WidgetId,
  customizing: boolean,
  drag: DragState,
  aggregatedStats?: AggregatedStats,
): ReactNode {
  const inner =
    id === 'hashrate' ? (
      <LiveHashrateCard />
    ) : id === 'connect' ? (
      <ConnectWorkersCard />
    ) : id === 'stats' ? (
      <WorkerStatCards aggregated={aggregatedStats} />
    ) : (
      <MiningPerformanceChart />
    );
  const tour = id === 'hashrate' ? 'hashrate' : id === 'stats' ? 'stats' : id === 'performance' ? 'performance' : undefined;
  return (
    <WidgetShell key={id} id={id} customizing={customizing} drag={drag} tour={tour}>
      {inner}
    </WidgetShell>
  );
}

/**
 * The dashboard landing: live hashrate, connect-workers credentials, worker stats,
 * and the performance chart, plus a floating setup checklist. Customization mode lets
 * a miner show/hide and reorder the widgets (persisted per browser), and Take tour
 * walks a new user through the page.
 */
export function DashboardHome() {
  const { layout, toggle, reorder, reset } = useDashboardLayout();
  const { aggregated } = useAggregatedModeContext();
  // Only fetches the per-subaccount roll-up while aggregated mode is on.
  const { stats: aggStats, slices } = useAggregatedData(aggregated);
  const [customizing, setCustomizing] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const toast = useToast();
  const [dragId, setDragId] = useState<WidgetId | null>(null);
  const [overId, setOverId] = useState<WidgetId | null>(null);
  // Drop fires within the same interaction, before React commits the latest state,
  // so the drop handler reads the live drag/over ids from refs, not the closed-over
  // state (which would still be null).
  const dragRef = useRef<WidgetId | null>(null);
  const overRef = useRef<WidgetId | null>(null);

  const drag: DragState = {
    dragId,
    overId,
    onDragStart: (id) => {
      dragRef.current = id;
      setDragId(id);
    },
    onDragOverId: (id) => {
      if (overRef.current !== id) {
        overRef.current = id;
        setOverId(id);
      }
    },
    onDrop: () => {
      const from = dragRef.current;
      const to = overRef.current;
      // Only confirm when the drop actually moved something; dropping a widget back
      // where it started is not a saved layout.
      if (from && to && from !== to) {
        reorder(from, layout.order.indexOf(to));
        toast({ type: 'info', message: 'Layout saved' });
      }
    },
    onDragEnd: () => {
      dragRef.current = null;
      overRef.current = null;
      setDragId(null);
      setOverId(null);
    },
  };

  // The widgets to render, in the saved order, hidden ones removed.
  const visibleIds = visibleInOrder(layout).map((w) => w.id);

  // Walk the visible widgets in order. Hashrate and Connect share a 3:2 row ONLY when
  // they end up adjacent (in either order); if the user reorders a widget between
  // them, each falls back to full width. Everything else renders full width in place.
  const rendered: ReactNode[] = [];
  for (let i = 0; i < visibleIds.length; i += 1) {
    const id = visibleIds[i];
    const next = visibleIds[i + 1];
    const isPair = (a: WidgetId, b: WidgetId) =>
      (a === 'hashrate' && b === 'connect') || (a === 'connect' && b === 'hashrate');
    // While dragging, don't glue the pair into a shared row, so each is an independent
    // drop target.
    if (next && !customizing && isPair(id, next)) {
      rendered.push(<HashrateConnectRow key="hashrate-connect-row" customizing={customizing} drag={drag} />);
      i += 1; // consume the paired widget
      continue;
    }
    rendered.push(widgetBlock(id, customizing, drag, aggregated ? aggStats : undefined));
  }

  // The combined-hashrate breakdown belongs to aggregated mode rather than the
  // customizable widget set, and the design places it under the first row, above the
  // stat cards.
  if (aggregated && slices.length > 0) {
    rendered.splice(1, 0, <CombinedHashrateCard key="combined-hashrate" slices={slices} total={aggStats.combinedHashrate} />);
  }

  return (
    <div className="space-y-4">
      {customizing && (
        <div className="fixed left-1/2 top-20 z-40 -translate-x-1/2">
          <button
            type="button"
            onClick={() => {
              setCustomizing(false);
              setPanelOpen(false);
            }}
            className="rounded-full bg-[hsl(var(--btn))] px-5 py-2 text-sm font-medium text-[hsl(var(--btn-foreground))] shadow-lg"
          >
            Leave customization mode
          </button>
        </div>
      )}

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold leading-9 tracking-[-1px] text-heading">Welcome back</h2>
          <p className="text-sm leading-5 text-body-alt">Mining data and earnings overview.</p>
        </div>
        <div className="relative flex shrink-0 items-center gap-3">
          {!aggregated && (
            <button type="button" onClick={() => setTourOpen(true)} className={HEADER_BUTTON}>
              <LiRouting2 className="h-3.5 w-3.5" />
              Take tour
            </button>
          )}
          <button
            type="button"
            data-tour="customize"
            onClick={() => {
              setCustomizing(true);
              setPanelOpen((o) => !o || !customizing);
            }}
            aria-expanded={panelOpen}
            className={HEADER_BUTTON}
          >
            <LiTuning4 className="h-3.5 w-3.5" />
            Customize dashboard
          </button>
          {panelOpen && <CustomizeDashboardPanel layout={layout} onToggle={toggle} onReset={reset} />}
        </div>
      </header>

      {/* The design separates the header from the body by 16px and the body rows by 8px. */}
      <div className="space-y-2">{rendered}</div>

      <GettingStartedCard />
      {tourOpen && <ProductTour onClose={() => setTourOpen(false)} />}
    </div>
  );
}
