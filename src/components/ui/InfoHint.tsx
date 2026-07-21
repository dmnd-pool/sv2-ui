import * as Tooltip from '@radix-ui/react-tooltip';
import { LiQuestionCircle } from 'solar-icon-react/li';
import { overlayContainer } from '@/lib/utils';

/**
 * The small info icon next to a stat label that reveals an explanatory tooltip on
 * hover or keyboard focus, styled as the design's dark pill. Uses Radix Tooltip (not
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
            <LiQuestionCircle className="h-3.5 w-3.5" />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal container={overlayContainer()}>
          <Tooltip.Content
            side="top"
            align="center"
            sideOffset={6}
            collisionPadding={12}
            className="z-50 max-w-[248px] rounded-[16px] bg-[#0a0a0a] p-4 text-xs leading-relaxed text-[#a3a3a3] shadow-xl"
          >
            {text}
            <Tooltip.Arrow className="fill-[#0a0a0a]" width={12} height={6} />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
