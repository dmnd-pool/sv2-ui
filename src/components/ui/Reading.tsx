import { cn } from '@/lib/utils';

/**
 * A numeric readout: a numeral in the heading face with its unit trailing at body size.
 *
 * The two are separated by an oversized space run rather than a plain space, because
 * the numeral carries negative letter-spacing and a normal space would be pulled into
 * the digits. Keeping the tracking on the numeral span (never the paragraph) is what
 * stops the unit from colliding with the number.
 */
export function Reading({
  value,
  unit,
  size = 'md',
  unitSize,
  tone = 'default',
  className,
}: {
  value: string | number;
  unit?: string;
  /** lg = the card headline, md = a stat card, sm = one side of a split row. */
  size?: 'sm' | 'md' | 'lg';
  /** The design sets some units a step smaller than the card's default. */
  unitSize?: 'base' | 'lg';
  tone?: 'default' | 'success' | 'muted';
  className?: string;
}) {
  const numeral = {
    lg: 'text-4xl font-semibold leading-[48px] tracking-[-2.8px]',
    md: 'text-2xl font-bold leading-9 tracking-[-1px]',
    sm: 'text-2xl font-medium leading-9 tracking-[-1px]',
  }[size];
  const unitClass = unitSize
    ? { base: 'text-base font-normal leading-6', lg: 'text-lg font-normal leading-7' }[unitSize]
    : { lg: 'text-xl font-normal leading-7', md: 'text-lg font-normal leading-7', sm: 'text-sm font-light leading-5' }[size];
  const toneClass = {
    default: 'text-foreground',
    success: 'text-success-text',
    muted: 'text-body-alt',
  }[tone];

  return (
    <p className={cn('font-heading', toneClass, className)}>
      <span className={numeral}>{value}</span>
      {unit && (
        <>
          {/* The design's separator is a 56px space, which also sets the row height. */}
          <span aria-hidden className="text-[56px] leading-[64px] tracking-normal">
            {' '}
          </span>
          <span className={cn('font-body tracking-normal text-body-alt', unitClass)}>{unit}</span>
        </>
      )}
    </p>
  );
}
