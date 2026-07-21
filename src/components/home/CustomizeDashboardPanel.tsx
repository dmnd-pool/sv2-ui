import { Fragment, useState } from 'react';
import { LiAltArrowDown, LiRestart } from 'solar-icon-react/li';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { widgetsForPanel, type DashboardLayout, type WidgetId } from '@/lib/dashboardLayout';

/**
 * The Customize dashboard panel shown in customization mode. Each widget row has a
 * checkbox to show or hide it plus a status label; reordering is done by dragging the
 * widgets directly on the dashboard, so the panel has no reorder controls. The header
 * chevron collapses the panel to just its title and the restore action; leaving
 * customization mode is done from the dashboard, not from here.
 */
export function CustomizeDashboardPanel({
  layout,
  onToggle,
  onReset,
}: {
  layout: DashboardLayout;
  onToggle: (id: WidgetId) => void;
  onReset: () => void;
}) {
  const rows = widgetsForPanel(layout);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="absolute right-0 top-full z-30 mt-2 flex w-[330px] max-w-[calc(100vw-2rem)] flex-col items-center gap-[15px] rounded-[24px] bg-secondary pt-6 shadow-[0_20px_30px_-5px_rgba(0,0,0,0.08),0_8px_20px_-6px_rgba(0,0,0,0.08)]">
      <div className="flex w-full items-start gap-4 px-8">
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold text-heading">Customize dashboard</p>
          {!collapsed && (
            <p className="text-sm text-body-alt">Drag widgets directly on the dashboard. Show or hide widgets here.</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand customize panel' : 'Collapse customize panel'}
          aria-expanded={!collapsed}
          className="flex shrink-0 items-center rounded-full bg-muted p-2 text-body-alt transition-colors hover:text-foreground"
        >
          <LiAltArrowDown className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
        </button>
      </div>

      <div className="flex w-full flex-col gap-4 rounded-[24px] bg-muted px-8 py-6">
        {!collapsed && (
          <>
            <ul className="flex flex-col gap-4">
              {rows.map((w, i) => (
                <Fragment key={w.id}>
                  {i > 0 && <li aria-hidden className="h-px w-full bg-border" />}
                  <li className="flex items-center gap-3">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={w.visible}
                      aria-label={`${w.visible ? 'Hide' : 'Show'} ${w.label}`}
                      onClick={() => onToggle(w.id)}
                      className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors',
                        w.visible ? 'border-[hsl(var(--btn))] bg-[hsl(var(--btn))]' : 'border-placeholder',
                      )}
                    >
                      {w.visible && <Check className="h-3.5 w-3.5 text-[hsl(var(--btn-foreground))]" strokeWidth={3} />}
                    </button>
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">{w.label}</span>
                    <span className="shrink-0 text-xs text-body-alt">{w.visible ? 'Showing' : 'Hidden'}</span>
                  </li>
                </Fragment>
              ))}
            </ul>
            <div aria-hidden className="h-px w-full bg-border" />
          </>
        )}

        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1 self-start text-base text-foreground transition-colors hover:text-body-alt"
        >
          Restore to default
          <LiRestart className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
