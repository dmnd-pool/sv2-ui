import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import {
  LiCheckCircle,
  LiCloseCircle,
  LiCloseSquare,
  LiInfoCircle,
  LiShieldWarning,
} from 'solar-icon-react/li';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
  /** Optional second line under the bold title (e.g. the CSV-export toasts). */
  description?: string;
}

interface ToastContextValue {
  /** Shows a toast and returns its id so the caller can dismiss it early. */
  toast: (input: { type: ToastType; message: string; description?: string }) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICON = { success: LiCheckCircle, error: LiCloseCircle, warning: LiShieldWarning, info: LiInfoCircle };

// Info Prompt: solid tinted pill, radius 16. success/error/warning use
// the light status tints with dark body text; the neutral (info) state is a dark
// pill with light text. All flip per theme via the --toast-* tokens.
const TINT: Record<ToastType, string> = {
  success: 'bg-toast-success text-foreground',
  error: 'bg-toast-error text-foreground',
  warning: 'bg-toast-warning text-foreground',
  info: 'bg-toast-neutral text-[#D4D4D4]',
};
// Icon colours per state (constant across themes).
const ICON_COLOR: Record<ToastType, string> = {
  success: 'text-[#16A34A]',
  error: 'text-[#EF4444]',
  warning: 'text-[#EAB308]',
  info: 'text-[#3B82F6]',
};

const DURATION_MS = 5000;
let nextId = 0;

/** Top-centre toast notifications. One provider near the app root. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (input: { type: ToastType; message: string; description?: string }) => {
      const id = nextId++;
      setToasts((current) => [...current, { id, ...input }]);
      setTimeout(() => dismiss(id), DURATION_MS);
      return id;
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div className="dmnd-auth pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => {
          const Icon = ICON[t.type];
          return (
            <div
              key={t.id}
              role="status"
              className={cn(
                'pointer-events-auto flex items-center gap-2.5 rounded-[16px] px-4 py-3 text-sm shadow-lg',
                TINT[t.type],
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0', ICON_COLOR[t.type])} />
              <div className="flex flex-col">
                <span className="font-bold">{t.message}</span>
                {t.description && <span className="text-xs font-normal opacity-80">{t.description}</span>}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                className="ml-2 shrink-0 opacity-70 transition-opacity hover:opacity-100"
              >
                <LiCloseSquare className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue['toast'] {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx.toast;
}

/** Both the toast fn and a dismiss handle, for flows that replace a toast (e.g. CSV export). */
export function useToastControls(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToastControls must be used within a ToastProvider');
  return ctx;
}
