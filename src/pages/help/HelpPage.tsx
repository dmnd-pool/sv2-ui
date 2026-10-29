import { useState } from 'react';
import { useAuth } from '@/auth';
import { useQuery } from '@tanstack/react-query';
import { BLOG_URL, latestBlogQueryOptions } from '@/hooks/useAccountData';

import type { ComponentType } from 'react';
import { BookOpen, Shield, FileText } from 'lucide-react';
import { LiAltArrowRight } from 'solar-icon-react/li';
import { BdLetter, BdCodeSquare } from 'solar-icon-react/bd';

// Existing DMND destinations. Resources without a URL have a disabled action.
const CLIENT_GUIDE_URL = 'https://github.com/dmnd-pool/dmnd-client/blob/master/README.md';
const API_DOCS_URL = 'https://www.dmnd.work/api.html';
const CONTACT_EMAIL = 'info@dmnd.work';
const DASHBOARD_VERSION = 'v2.0.0';

interface HelpRow {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action: string;
  href: string;
}

const ROWS: HelpRow[] = [
  // {
  //   icon: BdQuestionCircle,
  //   title: 'Frequently asked questions',
  //   description: 'Browse common questions about DMND and Bitcoin mining.',
  //   action: 'View FAQs',
  //   href: FAQ_URL,
  // },
  {
    icon: BdLetter,
    title: 'Contact us',
    description: 'Need help or have a question? Get in touch with the DMND team.',
    action: 'Send email',
    href: `mailto:${CONTACT_EMAIL}`,
  },
  {
    icon: BdCodeSquare,
    title: 'DMND Client setup guide',
    description: 'Set up and run the DMND Stratum V2 client.',
    action: 'View guide',
    href: CLIENT_GUIDE_URL,
  },
  {
    icon: BookOpen,
    title: 'API documentation',
    description: 'Connect your tools to DMND mining data and payouts.',
    action: 'View API docs',
    href: API_DOCS_URL,
  },
  {
    icon: Shield,
    title: 'Privacy Policy',
    description: 'Learn how DMND handles your information.',
    action: 'View policy',
    href: 'https://www.dmnd.work/privacypolicy.html',
  },
  {
    icon: FileText,
    title: 'Terms of service',
    description: 'Read the terms for using DMND services.',
    action: 'View terms',
    href: 'https://www.dmnd.work/termsofservice.html',
  },
];

/**
 * The Help & Support page, reached from the top-bar help icon. It gathers the ways to
 * get help with DMND: a learning link, and rows for FAQs, community, contact, and
 * developer resources, product information, and policies. Resources without a
 * confirmed URL retain a disabled action until a destination is available.
 */
export function HelpPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-heading">Help &amp; Support</h1>
        <p className="mt-1 text-sm text-body-alt">Need assistance? Here are a few ways to get help with DMND.</p>
      </header>
      <div className="h-[0.5px] w-full bg-border" />

      <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        <section className="space-y-6">
          <div>
            <h2 className="!font-body text-base font-semibold leading-6 text-heading">Learn about DMND</h2>
            <p className="mt-1 text-sm text-body-alt">
              Understand how DMND works, from FPPS and PPLNS to payouts, subaccounts, and dashboard features.
            </p>
            <LatestBlogCard />
          </div>
        </section>

        <section className="divide-y divide-border">
          {ROWS.map((row) => (
            <div key={row.title} className="flex flex-col gap-2 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
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
      <footer className="border-t border-border pt-4 text-xs text-body-alt">
        DMND Dashboard · {DASHBOARD_VERSION}
      </footer>
    </div>
  );
}

function LatestBlogCard() {
  const { session } = useAuth();
  const { data: post } = useQuery({
    ...latestBlogQueryOptions(session?.accountId ?? '', session?.loginId ?? ''),
    enabled: !!session,
  });
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const image = post?.image && post.image !== failedImage ? post.image : null;

  return <a
    href={post?.url ?? BLOG_URL}
    target="_blank"
    rel="noopener noreferrer"
    className="group relative mt-4 flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted text-sm font-medium text-body-alt transition-colors hover:text-foreground"
  >
    {image ? <>
      <img src={image} alt="" onError={() => setFailedImage(image)} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
      <div className="relative mt-auto w-full space-y-1 p-4 text-white">
        <p className="text-xs text-white/80">Latest from the DMND blog</p>
        <p className="text-base font-semibold">{post?.title}</p>
        <p className="text-xs text-white/80">Read the DMND blog ↗</p>
      </div>
    </> : 'Read the DMND blog'}
  </a>;
}
