import { LiAltArrowLeft, LiAltArrowRight } from 'solar-icon-react/li';
import { cn } from '@/lib/utils';

/** 1 .. n with ellipsis around the current page once there are more than 7 pages. */
function pageWindow(current: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | 'gap')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) out.push('gap');
  for (let i = start; i <= end; i += 1) out.push(i);
  if (end < total - 1) out.push('gap');
  out.push(total);
  return out;
}

/** Previous / numbered pages / Next. Hidden when there's only one page. */
export function WorkersPagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-2 px-5 py-4 text-sm">
      <button
        type="button"
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        className="inline-flex items-center gap-1 text-body-alt transition-colors hover:text-foreground disabled:opacity-40"
      >
        <LiAltArrowLeft className="h-4 w-4" />
        Previous
      </button>

      <div className="flex items-center gap-1">
        {pageWindow(page, totalPages).map((p, i) =>
          p === 'gap' ? (
            <span key={`gap-${i}`} className="px-2 text-placeholder">
              &hellip;
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPage(p)}
              aria-current={p === page ? 'page' : undefined}
              className={cn(
                'flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm transition-colors',
                p === page ? 'bg-muted font-medium text-foreground' : 'text-body-alt hover:bg-muted hover:text-foreground',
              )}
            >
              {p}
            </button>
          ),
        )}
      </div>

      <button
        type="button"
        onClick={() => onPage(page + 1)}
        disabled={page >= totalPages}
        className="inline-flex items-center gap-1 text-body-alt transition-colors hover:text-foreground disabled:opacity-40"
      >
        Next
        <LiAltArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}
