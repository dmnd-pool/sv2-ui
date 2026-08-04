import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { BdCheckCircle, BdCloseCircle, BdInfoCircle, BdShieldWarning } from 'solar-icon-react/bd';
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

// The design draws every Info Prompt glyph in the Bold style, not the outline one.
const ICON = { success: BdCheckCircle, error: BdCloseCircle, warning: BdShieldWarning, info: BdInfoCircle };

// Info Prompt: solid tinted pill, radius 16. success/error/warning use
// the light status tints with dark body text; the neutral (info) state is a dark
// pill with light text. All flip per theme via the --toast-* tokens.
const TINT: Record<ToastType, string> = {
  success: 'bg-toast-success text-foreground',
  error: 'bg-toast-error text-foreground',
  warning: 'bg-toast-warning text-foreground',
  info: 'bg-toast-neutral text-[#D4D4D4]',
};
// Only the dark neutral pill is drawn with elevation; the tinted ones carry none.
const SHADOW: Record<ToastType, string> = {
  success: '',
  error: '',
  warning: '',
  info: 'shadow-[0_20px_30px_-5px_rgba(0,0,0,0.05),0_8px_20px_-6px_rgba(0,0,0,0.05)]',
};
// The dark pill sets its title one step lighter than the body; the tinted ones use one colour.
const TITLE_TONE: Record<ToastType, string> = {
  success: '',
  error: '',
  warning: '',
  info: 'text-[#E5E5E5]',
};
// Icon colours per state (constant across themes).
const ICON_COLOR: Record<ToastType, string> = {
  success: 'text-[#22C55E]',
  error: 'text-[#EF4444]',
  warning: 'text-[#EAB308]',
  info: 'text-[#D4D4D4]',
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
                'pointer-events-auto flex w-[448px] max-w-full items-start justify-between gap-1 rounded-[16px] p-3',
                TINT[t.type],
                SHADOW[t.type],
              )}
            >
              <span className="flex items-start gap-1">
                {/* The icon sits 2px low so its optical centre lines up with the title. */}
                <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', ICON_COLOR[t.type])} />
                <span className="flex flex-col">
                  <span className={cn('text-base font-bold leading-6', TITLE_TONE[t.type])}>{t.message}</span>
                  {t.description && <span className="text-sm leading-5">{t.description}</span>}
                </span>
              </span>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                className="shrink-0 transition-opacity hover:opacity-70"
              >
                <X className="h-5 w-5" />
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
