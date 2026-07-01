import type { ReactNode } from 'react';

/** The centered icon + title + subtitle empty state used inside the home cards. */
export function CardEmptyState({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
      <div className="mb-3 text-placeholder">{icon}</div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 max-w-xs text-xs text-body-alt">{subtitle}</p>
    </div>
  );
}
