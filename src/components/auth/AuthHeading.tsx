interface AuthHeadingProps {
  title: string;
  subtitle?: string;
}

/**
 * Auth + reset screen heading: centered on desktop, left-aligned on mobile.
 * Radio Canada Big 600, 24/36, -1px title; Geist 300, 12px subtitle.
 */
export function AuthHeading({ title, subtitle }: AuthHeadingProps) {
  return (
    <div className="space-y-1 text-left lg:text-center">
      <h1 className="text-2xl font-semibold leading-9 tracking-[-1px] text-foreground">{title}</h1>
      {subtitle && <p className="text-xs font-light leading-4 text-body-alt">{subtitle}</p>}
    </div>
  );
}
