import type { ReactNode } from 'react';

/** Shared home layout; callers provide only permitted widgets and session-specific actions. */
export function DashboardHomeView({ title = 'Welcome back', subtitle = 'Mining data and earnings overview.', actions, footer, children }: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold leading-9 tracking-[-1px] text-heading">{title}</h2>
          <p className="text-sm leading-5 text-body-alt">{subtitle}</p>
        </div>
        {actions}
      </header>
      <div className="space-y-1.5">{children}</div>
      {footer}
    </div>
  );
}
