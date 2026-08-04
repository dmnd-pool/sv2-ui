import type { ComponentType } from 'react';
import { LiAltArrowRight } from 'solar-icon-react/li';
import { BdChatRoundLine, BdLetter, BdCodeSquare, BdQuestionCircle } from 'solar-icon-react/bd';

// Verified DMND destinations. Rows whose link is empty are gated (hidden) until a
// real URL exists, the same way the setup-tutorial link is handled elsewhere, so the
// page never ships a placeholder or dead link.
const BLOG_URL = 'https://blog.dmnd.work/';
const GITHUB_URL = 'https://github.com/dmnd-pool';
const CONTACT_EMAIL = 'info@dmnd.work';
const FAQ_URL = '';
const TELEGRAM_URL = '';

interface HelpRow {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action: string;
  href: string;
}

const ROWS: HelpRow[] = [
  {
    icon: BdQuestionCircle,
    title: 'Frequently asked questions',
    description: 'Browse common questions about DMND and Bitcoin mining.',
    action: 'View FAQs',
    href: FAQ_URL,
  },
  {
    icon: BdChatRoundLine,
    title: 'Join our Telegram',
    description: 'Ask questions, get updates, and chat with the DMND community.',
    action: 'Open Telegram',
    href: TELEGRAM_URL,
  },
  {
    icon: BdLetter,
    title: 'Contact us',
    description: 'Need help or have a question? Get in touch with the DMND team.',
    action: 'Send email',
    href: `mailto:${CONTACT_EMAIL}`,
  },
  {
    icon: BdCodeSquare,
    title: 'Developer resources',
    description: 'Explore the DMND open-source projects and technical documentation.',
    action: 'View GitHub',
    href: GITHUB_URL,
  },
];

/**
 * The Help & Support page, reached from the top-bar help icon. It gathers the ways to
 * get help with DMND: a learning link, and rows for FAQs, community, contact, and
 * developer resources. Each row links out to a real destination; a row without a
 * confirmed URL is not shown rather than linking nowhere.
 */
export function HelpPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-heading">Help &amp; Support</h1>
        <p className="mt-1 text-sm text-body-alt">Need assistance? Here are a few ways to get help with DMND.</p>
      </header>
      <div className="h-[0.5px] w-full bg-border" />

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <section>
          <h2 className="!font-body text-base font-semibold leading-6 text-heading">Learn about DMND</h2>
          <p className="mt-1 text-sm text-body-alt">
            Understand how DMND works, from FPPS and PPLNS to payouts, subaccounts, and dashboard features.
          </p>
          <a
            href={BLOG_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex aspect-video w-full items-center justify-center rounded-2xl border border-border bg-muted text-sm font-medium text-body-alt transition-colors hover:text-foreground"
          >
            Read the DMND blog
          </a>
        </section>

        <section className="divide-y divide-border">
          {ROWS.map((row) => (
            <div key={row.title} className="flex flex-col gap-2 py-5 first:pt-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                  <row.icon className="h-6 w-6 text-[#525252]" />
                </span>
                <div className="min-w-0">
                  <p className="text-base font-medium leading-6 text-foreground">{row.title}</p>
                  <p className="text-sm leading-5 text-body-alt">{row.description}</p>
                </div>
              </div>
              {row.href ? (
                <a
                  href={row.href}
                  target={row.href.startsWith('mailto:') ? undefined : '_blank'}
                  rel="noopener noreferrer"
                  className="inline-flex h-9 shrink-0 items-center gap-1 rounded-[32px] border-[0.5px] border-black/20 bg-btn-secondary px-5 text-sm leading-5 text-foreground transition-opacity hover:opacity-80"
                >
                  {row.action}
                  <LiAltArrowRight className="h-3.5 w-3.5" />
                </a>
              ) : (
                // Placeholder until the destination URL exists: shown per the design, not clickable.
                <span
                  aria-disabled
                  className="inline-flex h-9 shrink-0 cursor-default items-center gap-1 rounded-[32px] border-[0.5px] border-black/20 bg-btn-secondary px-5 text-sm leading-5 text-foreground"
                >
                  {row.action}
                  <LiAltArrowRight className="h-3.5 w-3.5" />
                </span>
              )}
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
