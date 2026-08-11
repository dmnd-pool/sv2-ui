import { useState, type ReactNode } from 'react';
import { LiCopy, LiCheckCircle } from 'solar-icon-react/li';
import { BoInfoCircle } from 'solar-icon-react/bo';
import { OlArrowRightUp } from 'solar-icon-react/ol';
import { cn } from '@/lib/utils';

/**
 * Shared building blocks for the long-form guide pages.
 *
 * The frames draw code in the body face rather than a monospace one. Blocks whose
 * meaning depends on column alignment pass `aligned`, which switches them to the
 * configured monospace family so their padding survives; everything else keeps the
 * drawn face.
 */

/** An inline code chip: the most-used element on these pages. */
export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded bg-muted px-1 py-0.5 text-xs leading-4 text-body-alt">{children}</span>
  );
}

/**
 * The banner that heads each guide. The illustration is exported at 2x from the
 * design: it is a dense vector map that would be thousands of inline paths, and the
 * two guides crop it differently, so each carries its own asset.
 */
export function DocHero({ src, height = 153, alt = '' }: { src: string; height?: number; alt?: string }) {
  return (
    <div className="overflow-hidden bg-[#3B82F6]" style={{ height }}>
      <img src={src} alt={alt} className="h-full w-full object-cover" />
    </div>
  );
}

/**
 * A page section: heading, optional number, and its content. `level` only picks the
 * heading element so a numbered subsection (3.1 under 3) nests correctly for screen
 * readers; both levels carry identical classes, so the rendering is unchanged.
 */
export function DocSection({
  number,
  title,
  level = 2,
  children,
}: {
  number?: string;
  title: string;
  level?: 2 | 3;
  children: ReactNode;
}) {
  const Heading = level === 3 ? 'h3' : 'h2';
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2">
        {number && <span className="text-sm leading-5 text-body-alt">{number}</span>}
        <Heading className="!font-body text-base font-semibold leading-6 text-heading">{title}</Heading>
      </div>
      {children}
    </section>
  );
}

/** Body copy. */
export function DocText({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-5 text-body-alt">{children}</p>;
}

/** An unordered list. The frames pack these into single text nodes; real list
 *  semantics are used here so screen readers announce the item count. */
export function DocList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1 pl-5">
      {items.map((item, i) => (
        <li key={i} className="text-sm leading-5 text-body-alt">
          {item}
        </li>
      ))}
    </ul>
  );
}

/**
 * A copyable code block. `aligned` opts into the monospace family for blocks whose
 * columns are space-padded and would otherwise render ragged.
 */
export function CodeBlock({
  code,
  aligned = false,
  className,
}: {
  code: string;
  aligned?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={cn('flex items-start gap-3 rounded-xl bg-muted px-4 py-2', className)}>
      <pre
        className={cn(
          'min-w-0 flex-1 overflow-x-auto whitespace-pre text-sm leading-5 text-foreground',
          // `pre` defaults to the mono family, so the drawn body face has to be set
          // back explicitly; only the column-aligned blocks keep monospace.
          aligned ? 'font-mono' : 'font-body',
        )}
      >
        {code}
      </pre>
      <span className="flex shrink-0 items-center gap-3 pt-0.5">
        <span aria-hidden className="h-6 w-[0.5px] bg-border" />
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? 'Copied' : 'Copy code'}
          className="inline-flex items-center gap-1 text-sm leading-5 text-foreground transition-opacity hover:opacity-80"
        >
          {copied ? 'Copied' : 'Copy'}
          {copied ? <LiCheckCircle className="h-3.5 w-3.5 text-success" /> : <LiCopy className="h-3.5 w-3.5" />}
        </button>
      </span>
    </div>
  );
}

/** A note callout: a tinted panel with a coloured left rule. */
export function DocCallout({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-l border-[#A855F7] bg-[#A855F7]/5 px-6 py-3">
      <p className="text-sm font-medium leading-5 text-foreground">{label}</p>
      <div className="text-sm leading-5 text-body-alt">{children}</div>
    </div>
  );
}

/** A reference table. */
export function DocTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b-[0.5px] border-border bg-muted text-sm leading-5 text-body-alt">
            {headers.map((h) => (
              <th key={h} className="px-6 py-4 text-left font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b-[0.5px] border-border last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="px-6 py-4 text-foreground">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The footer prompt that closes every guide page. It is the Info Prompt component in
 * its fuchsia variant, the one tint with no token yet, so the two colours are written
 * literally the same way the callout above writes its purple.
 */
export function DocFooterPrompt({ href }: { href: string }) {
  return (
    <div className="flex flex-col gap-3 bg-[#FAE8FF] px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-1">
        <span className="shrink-0 pt-0.5">
          <BoInfoCircle className="h-5 w-5 text-[#D946EF]" />
        </span>
        <div>
          <p className="text-sm font-bold leading-5 text-foreground">Need the complete implementation?</p>
          <p className="text-sm leading-5 text-foreground">
            Explore the source code, documentation, examples, and setup guides on GitHub.
          </p>
        </div>
      </div>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex shrink-0 items-center gap-1 self-start border-b-[0.5px] border-foreground pb-0.5 text-sm leading-5 text-foreground transition-opacity hover:opacity-80 sm:self-auto"
      >
        Open GitHub
        <OlArrowRightUp className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}

/** The page shell shared by every guide: title, rule, and the content card. */
export function DocPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-bold leading-9 tracking-[-1px] text-heading">{title}</h1>
      </header>
      <div className="h-[0.5px] w-full bg-border" />
      <div className="flex flex-col gap-6">{children}</div>
    </div>
  );
}
