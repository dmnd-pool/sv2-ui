import { useEffect } from 'react';
import { LiCloseCircle } from 'solar-icon-react/li';
import { ConnectionDetails } from './ConnectionDetails';

/** A small dialog with the pool credentials, opened from the "Connect worker" button. */
export function ConnectWorkerModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Connect a worker"
        className="relative w-full max-w-lg rounded-xl border border-border bg-popover p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-heading">Connect a worker</h2>
            <p className="mt-1 text-sm text-body-alt">
              Point your mining hardware at the pool with these credentials.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 text-placeholder transition-colors hover:text-foreground"
          >
            <LiCloseCircle className="h-6 w-6" />
          </button>
        </div>

        <div className="mt-4 rounded-xl bg-muted px-4">
          <ConnectionDetails />
        </div>
      </div>
    </div>
  );
}
