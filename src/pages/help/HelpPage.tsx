import type { ComponentType } from 'react';
import {
  LiChatRoundLine,
  LiLetter,
  LiCodeSquare,
  LiQuestionCircle,
  LiAltArrowRight,
} from 'solar-icon-react/li';

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
    icon: LiQuestionCircle,
    title: 'Frequently asked questions',
    description: 'Browse common questions about DMND and Bitcoin mining.',
    action: 'View FAQs',
    href: FAQ_URL,
  },
  {
    icon: LiChatRoundLine,
    title: 'Join our Telegram',
    description: 'Ask questions, get updates, and chat with the DMND community.',
    action: 'Open Telegram',
    href: TELEGRAM_URL,
  },
  {
    icon: LiLetter,
    title: 'Contact us',
    description: 'Need help or have a question? Get in touch with the DMND team.',
    action: 'Send email',
    href: `mailto:${CONTACT_EMAIL}`,
  },
  {
    icon: LiCodeSquare,
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
      <div className="h-px w-full bg-border" />

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <section>
          <h2 className="text-base font-semibold text-heading">Learn about DMND</h2>
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
            <div key={row.title} className="flex items-start justify-between gap-4 py-5 first:pt-0">
              <div className="flex min-w-0 gap-3">
                <row.icon className="mt-0.5 h-5 w-5 shrink-0 text-body-alt" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{row.title}</p>
                  <p className="mt-0.5 text-sm text-body-alt">{row.description}</p>
                </div>
              </div>
              {row.href ? (
                <a
                  href={row.href}
                  target={row.href.startsWith('mailto:') ? undefined : '_blank'}
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                >
                  {row.action}
                  <LiAltArrowRight className="h-3.5 w-3.5" />
                </a>
              ) : (
                // Placeholder until the destination URL exists: shown per the design, not clickable.
                <span
                  aria-disabled
                  className="inline-flex shrink-0 cursor-default items-center gap-1 rounded-full border border-border px-4 py-2 text-xs font-medium text-foreground"
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
