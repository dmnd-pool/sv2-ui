import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AuthSubmitProps extends ButtonProps {
  /** Shows a 3-dot loading animation and disables the button. */
  loading?: boolean;
}

/**
 * The light pill primary button used across the auth screens.
 * Spec: 44px tall, pill, Geist 16px #262626 text, #F5F5F5 fill with
 * a 1px white/20 border; disabled fills #404040 (text stays #262626).
 */
export function AuthSubmit({ className, loading, disabled, children, ...props }: AuthSubmitProps) {
  return (
    <Button
      className={cn(
        'h-11 w-full rounded-full border border-white/20 bg-btn text-base font-normal text-btn-foreground hover:bg-btn/90',
        'disabled:bg-btn-disabled disabled:text-btn-foreground disabled:opacity-100',
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <LoadingDots /> : children}
    </Button>
  );
}

function LoadingDots() {
  return (
    <span className="flex items-center justify-center gap-1.5" aria-label="Loading">
      <span className="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-current" />
    </span>
  );
}
