import { LiInfoCircle, LiQuestionCircle } from 'solar-icon-react/li';
import { Switch } from '@/components/ui/switch';

/**
 * The blue notice shown at the top of every page while aggregated mode is on. It
 * explains the mode and carries an Exit toggle that mirrors the top-bar toggle, so a
 * miner can leave aggregated mode from wherever the banner is visible.
 */
export function AggregatedBanner({ onExit }: { onExit: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 bg-info/15 px-6 py-3">
      <div className="flex min-w-0 flex-1 items-start gap-1">
        <LiInfoCircle className="mt-0.5 h-5 w-5 shrink-0 text-info" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground">Viewing Aggregated Dashboard</p>
          <p className="text-sm text-foreground">
            You&apos;re viewing combined workers, earnings, and mining performance across all subaccounts.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="flex items-center gap-1 text-xs text-foreground">
          Exit Aggregated Mode
          <LiQuestionCircle className="h-4 w-4 text-placeholder" aria-hidden />
        </span>
        <Switch
          checked
          onCheckedChange={onExit}
          aria-label="Exit aggregated mode"
          className="data-[state=checked]:bg-success"
        />
      </div>
    </div>
  );
}
