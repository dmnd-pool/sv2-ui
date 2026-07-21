/**
 * The home dashboard's customizable widgets. The layout (order + which are hidden)
 * is persisted per browser so a miner can tailor their home. Only widgets that
 * actually exist on our home are listed; aggregated/subaccount widgets in the design
 * (combined hashrate, pending payouts, average uptime) aren't built yet, so they are
 * intentionally absent rather than shown as dead toggles.
 */
export type WidgetId = 'hashrate' | 'connect' | 'stats' | 'performance';

export interface WidgetDef {
  id: WidgetId;
  /** The name shown in the Customize panel's toggle list. */
  label: string;
  visible: boolean;
}

// Canonical order + labels. Order here is the default dashboard order.
export const DEFAULT_WIDGETS: WidgetDef[] = [
  { id: 'hashrate', label: 'Live Hashrate', visible: true },
  { id: 'connect', label: 'Connect Workers', visible: true },
  { id: 'stats', label: 'Worker Stats', visible: true },
  { id: 'performance', label: 'Mining Performance', visible: true },
];

export const WIDGET_IDS: WidgetId[] = DEFAULT_WIDGETS.map((w) => w.id);
const LABELS: Record<WidgetId, string> = Object.fromEntries(DEFAULT_WIDGETS.map((w) => [w.id, w.label])) as Record<
  WidgetId,
  string
>;

function isWidgetId(value: unknown): value is WidgetId {
  return typeof value === 'string' && (WIDGET_IDS as string[]).includes(value);
}

/** The persisted shape: an explicit order plus the set of hidden widgets. */
export interface DashboardLayout {
  order: WidgetId[];
  hidden: WidgetId[];
}

/**
 * Repair any stored (or absent) layout into a valid one: keep known ids in their
 * stored order, drop unknown ids, append any widget the stored order is missing
 * (so a newly-added widget appears), and keep only real ids in `hidden`. This makes
 * the persisted layout forward-compatible as widgets are added or removed.
 */
export function normalizeLayout(stored: unknown): DashboardLayout {
  const raw = (stored ?? {}) as Partial<DashboardLayout>;
  const storedOrder = Array.isArray(raw.order) ? raw.order.filter(isWidgetId) : [];
  const seen = new Set<WidgetId>();
  const order: WidgetId[] = [];
  for (const id of storedOrder) {
    if (!seen.has(id)) {
      seen.add(id);
      order.push(id);
    }
  }
  for (const id of WIDGET_IDS) {
    if (!seen.has(id)) order.push(id);
  }
  const hidden = Array.isArray(raw.hidden) ? raw.hidden.filter(isWidgetId) : [];
  return { order, hidden: [...new Set(hidden)] };
}

/** Show a hidden widget, or hide a shown one. Order is untouched. */
export function toggleWidget(layout: DashboardLayout, id: WidgetId): DashboardLayout {
  const hidden = layout.hidden.includes(id)
    ? layout.hidden.filter((x) => x !== id)
    : [...layout.hidden, id];
  return { order: layout.order, hidden };
}

/** Move a widget one slot up or down; a no-op at the edges. */
export function moveWidget(layout: DashboardLayout, id: WidgetId, dir: 'up' | 'down'): DashboardLayout {
  const i = layout.order.indexOf(id);
  if (i === -1) return layout;
  const j = dir === 'up' ? i - 1 : i + 1;
  if (j < 0 || j >= layout.order.length) return layout;
  const order = [...layout.order];
  [order[i], order[j]] = [order[j], order[i]];
  return { order, hidden: layout.hidden };
}

/** Move a widget to a target index (drag-and-drop), clamping and shifting the rest. */
export function reorderWidget(layout: DashboardLayout, id: WidgetId, toIndex: number): DashboardLayout {
  const from = layout.order.indexOf(id);
  if (from === -1) return layout;
  const to = Math.max(0, Math.min(toIndex, layout.order.length - 1));
  if (from === to) return layout;
  const order = [...layout.order];
  order.splice(from, 1);
  order.splice(to, 0, id);
  return { order, hidden: layout.hidden };
}

/** The widgets to render, in layout order, excluding the hidden ones. */
export function visibleInOrder(layout: DashboardLayout): WidgetDef[] {
  return layout.order
    .filter((id) => !layout.hidden.includes(id))
    .map((id) => ({ id, label: LABELS[id], visible: true }));
}

/** All widgets in layout order, each tagged with its current visibility (for the panel). */
export function widgetsForPanel(layout: DashboardLayout): WidgetDef[] {
  return layout.order.map((id) => ({ id, label: LABELS[id], visible: !layout.hidden.includes(id) }));
}
