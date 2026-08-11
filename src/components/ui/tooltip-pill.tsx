import * as Tooltip from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';
import { cn, overlayContainer } from '@/lib/utils';

/**
 * The design's tooltip pill, shared by every surface that reveals one on hover.
 *
 * The design ships it as one component with slots: the supporting-text slot renders
 * light on the muted foreground, the head-text slot renders semibold on the brighter
 * one. `emphasis` picks between those two rather than each caller restyling the pill.
 *
 * The pill inverts with the theme via the tooltip tokens rather than a fixed dark hex,
 * so it stays legible in both modes. Radix Tooltip (not Popover) so it opens and closes
 * with the pointer instead of latching open, and it portals into the themed shell so it
 * keeps the design tokens.
 */
export function TooltipPill({
  label,
  children,
  side = 'top',
  emphasis = false,
}: {
  label: string;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  emphasis?: boolean;
}) {
  return (
    <Tooltip.Provider delayDuration={0}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal container={overlayContainer()}>
          <Tooltip.Content
            side={side}
            align="center"
            sideOffset={6}
            collisionPadding={12}
            className={cn(
              'z-50 max-w-[331px] rounded-xl bg-tooltip px-4 py-3 text-sm leading-5 shadow-xl',
              emphasis ? 'font-semibold text-on-solid' : 'font-light text-on-solid-alt',
            )}
          >
            {label}
            <Tooltip.Arrow className="fill-tooltip" width={28} height={6} />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
