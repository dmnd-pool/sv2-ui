import * as Tooltip from '@radix-ui/react-tooltip';
import { LiQuestionCircle } from 'solar-icon-react/li';
import { overlayContainer } from '@/lib/utils';

/**
 * The small info icon next to a stat label that reveals an explanatory tooltip on
 * hover or keyboard focus, styled as the design's tooltip pill. The pill inverts with
 * the theme via the tooltip tokens rather than a fixed dark hex, so it stays legible in
 * both modes. Uses Radix Tooltip (not
 * Popover) so it opens and closes with the pointer instead of latching open, and
 * portals into the themed shell so it keeps the design tokens.
 */
export function InfoHint({ text }: { text: string }) {
  return (
    <Tooltip.Provider delayDuration={0}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            aria-label="More information"
            className="inline-flex shrink-0 text-placeholder transition-colors hover:text-body-alt"
          >
            <LiQuestionCircle className="h-4 w-4" />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal container={overlayContainer()}>
          <Tooltip.Content
            side="top"
            align="center"
            sideOffset={6}
            collisionPadding={12}
            className="z-50 max-w-[331px] rounded-xl bg-tooltip px-4 py-3 text-sm font-light leading-5 text-on-solid-alt shadow-xl"
          >
            {text}
            <Tooltip.Arrow className="fill-tooltip" width={28} height={6} />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
