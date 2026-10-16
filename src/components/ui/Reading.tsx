import { cn } from '@/lib/utils';

/**
 * A numeric readout: a numeral in the heading face with its unit trailing at body size.
 *
 * Value and unit have independent type styles. A margin separates them without adding
 * an invisible oversized line box, keeping every stat card compact.
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
    lg: 'text-3xl font-semibold leading-10 tracking-[-1.8px]',
    md: 'text-xl font-bold leading-8 tracking-[-0.5px]',
    sm: 'text-lg font-medium leading-7 tracking-[-0.5px]',
  }[size];
  const unitClass = unitSize
    ? { base: 'text-sm font-normal leading-5', lg: 'text-base font-normal leading-6' }[unitSize]
    : { lg: 'text-base font-normal leading-6', md: 'text-base font-normal leading-6', sm: 'text-xs font-light leading-4' }[size];
  const toneClass = {
    default: 'text-foreground',
    success: 'text-success-text',
    muted: 'text-body-alt',
  }[tone];

  return (
    <p className={cn('font-heading', toneClass, className)}>
      <span className={numeral}>{value}</span>
      {unit && <span className={cn('ml-2 font-body tracking-normal text-body-alt', unitClass)}>{unit}</span>}
    </p>
  );
}
