import { BdInfoCircle } from 'solar-icon-react/bd';
import { LiQuestionCircle } from 'solar-icon-react/li';
import { Switch } from '@/components/ui/switch';

/**
 * The blue notice shown at the top of every page while aggregated mode is on. It
 * explains the mode and carries an Exit toggle that mirrors the top-bar toggle, so a
 * miner can leave aggregated mode from wherever the banner is visible.
 *
 * The two viewports are drawn as separate variants: one row on desktop, and a stack on
 * mobile whose body copy is shorter and a size smaller, with the exit control dropping
 * below the text and indented to line up with it. The control itself is rendered once
 * and moved by layout, so there is never a second switch carrying the same label.
 */
export function AggregatedBanner({ onExit }: { onExit: () => void }) {
  return (
    <div className="flex flex-col bg-toast-info px-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6">
      <div className="flex min-w-0 flex-1 items-start gap-1">
        {/* The icon sits 2px low so it lines up with the title's cap height. */}
        <BdInfoCircle className="mt-0.5 h-5 w-5 shrink-0 text-info" aria-hidden />
        <div className="flex min-w-0 flex-col">
          <p className="text-sm font-bold leading-5 text-foreground">Viewing Aggregated Dashboard</p>
          <p className="text-xs leading-4 text-foreground sm:hidden">
            You&apos;re viewing combined data across all subaccounts.
          </p>
          <p className="hidden text-sm leading-5 text-foreground sm:block">
            You&apos;re viewing combined workers, earnings, and mining performance across all subaccounts.
          </p>
        </div>
      </div>

      {/* Mobile indents this by the icon column (20px icon + 4px gap) so it aligns
          under the copy; desktop drops the indent and sits at the far right. */}
      <div className="mt-1 ml-6 flex shrink-0 items-center gap-2 sm:mt-0 sm:ml-0">
        <span className="flex items-center gap-1 text-xs font-semibold leading-5 text-foreground">
          Exit Aggregated Mode
          <LiQuestionCircle className="h-4 w-4 text-body-alt" aria-hidden />
        </span>
        <Switch
          size="lg"
          checked
          onCheckedChange={onExit}
          aria-label="Exit aggregated mode"
          className="data-[state=checked]:bg-success"
        />
      </div>
    </div>
  );
}
