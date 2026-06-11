interface FullScreenStatusProps {
  message: string;
}

/**
 * Centered full-page status used while the app resolves auth, account, or
 * setup state before it knows which screen to show.
 */
export function FullScreenStatus({ message }: FullScreenStatusProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="h-8 w-8 mx-auto rounded-lg bg-primary animate-pulse flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-sm">SV2</span>
        </div>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
