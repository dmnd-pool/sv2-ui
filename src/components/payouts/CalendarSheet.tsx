import { createPortal } from 'react-dom';
import { cn, overlayContainer } from '@/lib/utils';
import { Calendar } from './Calendar';
import type { DateRange } from '@/lib/payoutsTable';

/**
 * Places the date picker the two ways the design draws it: a popover anchored to its
 * trigger on desktop, and a modal bottom sheet over a dimmed, blurred page on mobile.
 *
 * The mobile sheet is portalled out of the trigger's card because a card with its own
 * stacking context or overflow would clip a full-bleed sheet; the desktop popover stays
 * inline so it can be positioned against its anchor.
 */
export function CalendarSheet({
  anchorClassName,
  onCancel,
  onDone,
}: {
  /** Desktop-only positioning, relative to the trigger's positioned ancestor. */
  anchorClassName: string;
  onCancel: () => void;
  onDone: (range: DateRange) => void;
}) {
  const sheet = (
    <div className="fixed inset-0 z-50 sm:hidden">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[8px]" onClick={onCancel} aria-hidden />
      <div className="absolute inset-x-0 bottom-0">
        <Calendar onCancel={onCancel} onDone={onDone} />
      </div>
    </div>
  );

  return (
    <>
      {createPortal(sheet, overlayContainer())}
      <div className={cn('absolute z-20 hidden sm:block', anchorClassName)}>
        <Calendar onCancel={onCancel} onDone={onDone} />
      </div>
    </>
  );
}
