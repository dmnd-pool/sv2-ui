/**
 * A bitcoin-in-circle glyph in the linear/outline style, to pair with the solar
 * outline icons. A clean, compact redraw of the design's bitcoin-circle glyph bound
 * to `currentColor` (the raw Figma SVG export is a single 58KB over-subdivided path,
 * too heavy to inline).
 */
export function BitcoinCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M10 6.5v11M13 6.5v11" />
      <path d="M9.5 8.5h4.2a1.9 1.9 0 0 1 0 3.8H9.5m0 0h4.6a1.9 1.9 0 0 1 0 3.8H9.5V8.5Z" />
    </svg>
  );
}
