import { useState } from 'react';
import { LiArrowRightUp, LiGlobal } from 'solar-icon-react/li';
import { BdLockKeyholeMinimalistic } from 'solar-icon-react/bd';
import { cn } from '@/lib/utils';
import { useBrokerAuth } from '@/auth';
import { useTheme } from '@/hooks/useTheme';
import type { ThemePreference } from '@/lib/theme';
import { BrokerShell } from '@/components/broker/BrokerShell';

type BrokerSettingsTab = 'account' | 'preferences' | 'about';

// A broker has no 2FA and no payout address, so the miner Security tab has no
// counterpart here; the frames draw three tabs.
const TABS: { id: BrokerSettingsTab; label: string }[] = [
  { id: 'account', label: 'Account' },
  { id: 'preferences', label: 'Preferences' },
  { id: 'about', label: 'About' },
];

// The broker session carries only an id, an email and a reference code, so the
// profile fields the design draws have no value to read yet. They render with the
// design's own sample values until the account endpoint returns them.
const PROFILE_PLACEHOLDER = {
  firstName: 'John',
  lastName: 'Doe',
  companyName: 'DMND Mining Ltd',
  companyLocation: 'Lisbon, PT',
};

const DASHBOARD_VERSION = 'v2.0.0';

// The broker frames draw four link rows; unconfirmed destinations render as
// non-navigating placeholders rather than shipping a dead link.
const LINKS: { label: string; href: string }[] = [
  { label: 'Privacy Policy', href: '' },
  { label: 'Terms of service', href: '' },
  { label: 'Documentation', href: '' },
  { label: 'Contact us', href: 'mailto:info@dmnd.work' },
];

const THEMES: { variant: ThemePreference; label: string }[] = [
  { variant: 'light', label: 'Light' },
  { variant: 'dark', label: 'Dark' },
  { variant: 'system', label: 'System' },
];

function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="!font-body text-base font-semibold leading-6 text-heading">{title}</h2>
      <p className="mt-1 text-sm leading-5 text-body-alt">{subtitle}</p>
    </div>
  );
}

/** A labelled read-only field, styled like the other settings inputs. */
function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm leading-5 text-body-alt">{label}</span>
      <div className="flex h-10 items-center rounded-[16px] bg-muted px-4 py-2 text-sm leading-5 text-foreground">
        {value}
      </div>
    </div>
  );
}

function AccountTab({ email }: { email: string }) {
  return (
    <div className="max-w-[542px] space-y-10 sm:space-y-20">
      <div className="space-y-4">
        <SectionHeading title="Profile" subtitle="Manage your personal information and company details" />
        <div className="h-[0.5px] w-full bg-border" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ReadonlyField label="First name" value={PROFILE_PLACEHOLDER.firstName} />
          <ReadonlyField label="Last name" value={PROFILE_PLACEHOLDER.lastName} />
        </div>
        <ReadonlyField label="Email address" value={email} />
        <ReadonlyField label="Company name" value={PROFILE_PLACEHOLDER.companyName} />
        <ReadonlyField label="Company location" value={PROFILE_PLACEHOLDER.companyLocation} />
      </div>

      <div className="space-y-4">
        <SectionHeading title="Password" subtitle="Manage your password" />
        <div className="h-[0.5px] w-full bg-border" />
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-sm leading-5 text-body-alt">
            <BdLockKeyholeMinimalistic className="h-5 w-5" />
            <span className="tracking-widest">•••••••</span>
          </span>
          {/* Drawn as an action, but no broker password endpoint exists yet, so it
              stays inert rather than leading somewhere that cannot complete. */}
          <button
            type="button"
            disabled
            title="Password reset is coming soon"
            className="inline-flex h-9 shrink-0 items-center rounded-[32px] border-[0.5px] border-black/20 bg-btn-secondary px-5 text-sm leading-5 text-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            Change password
          </button>
        </div>
      </div>
    </div>
  );
}

function PreferencesTab() {
  const { preference, setTheme } = useTheme();
  return (
    <div className="max-w-[542px] space-y-10 sm:space-y-20">
      <div className="space-y-4">
        <SectionHeading title="Theme" subtitle="Choose the theme of your dashboard" />
        <div className="h-[0.5px] w-full bg-border" />
        <div className="flex flex-wrap gap-3">
          {THEMES.map((t) => (
            <button
              key={t.variant}
              type="button"
              aria-pressed={preference === t.variant}
              onClick={() => setTheme(t.variant)}
              className="flex w-[72px] flex-col items-center gap-2"
            >
              <span
                className={cn(
                  'h-16 w-full rounded-xl border transition-colors',
                  t.variant === 'light' ? 'bg-neutral-100' : t.variant === 'dark' ? 'bg-neutral-900' : 'bg-gradient-to-r from-neutral-100 to-neutral-900',
                  preference === t.variant ? 'border-[hsl(var(--btn))]' : 'border-border',
                )}
              />
              <span className={cn('text-xs', preference === t.variant ? 'font-medium text-foreground' : 'text-body-alt')}>
                {t.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <SectionHeading title="Localization" subtitle="The language used across your dashboard" />
        <div className="h-[0.5px] w-full bg-border" />
        <div className="flex flex-col gap-1">
          <span className="text-sm leading-5 text-body-alt">Display language</span>
          {/* States the language rather than offering a choice: it is set server-side
              with no endpoint to change it. */}
          <div className="flex h-10 items-center gap-3 rounded-[16px] bg-muted px-4 py-2 text-sm leading-5 text-foreground" aria-disabled>
            <LiGlobal className="h-3.5 w-3.5 text-[#525252]" />
            English
          </div>
        </div>
      </div>
    </div>
  );
}

function AboutTab() {
  return (
    <div className="max-w-[542px] space-y-10 sm:space-y-14">
      <div className="space-y-4">
        <SectionHeading title="DMND Dashboard" subtitle={DASHBOARD_VERSION} />
        <div className="h-[0.5px] w-full bg-border" />
      </div>

      <div className="space-y-4">
        <SectionHeading title="Links" subtitle="Access our important documents and social addresses" />
        <div className="h-[0.5px] w-full bg-border" />
        <ul className="space-y-4">
          {LINKS.map((link) => (
            <li key={link.label}>
              {link.href ? (
                <a
                  href={link.href}
                  target={link.href.startsWith('mailto:') ? undefined : '_blank'}
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 border-b-[0.5px] border-foreground pb-0.5 text-sm leading-5 text-foreground transition-opacity hover:opacity-80"
                >
                  {link.label}
                  <LiArrowRightUp className="h-3.5 w-3.5" />
                </a>
              ) : (
                <span
                  aria-disabled
                  className="inline-flex cursor-default items-center gap-1 border-b-[0.5px] border-foreground pb-0.5 text-sm leading-5 text-foreground"
                >
                  {link.label}
                  <LiArrowRightUp className="h-3.5 w-3.5" />
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Broker settings: account details, dashboard preferences and app information. */
export function BrokerSettings() {
  const { session } = useBrokerAuth();
  const [tab, setTab] = useState<BrokerSettingsTab>('account');

  return (
    <BrokerShell>
      <div className="space-y-6">
        <header>
          <h2 className="font-heading text-2xl font-semibold leading-9 tracking-[-1px] text-heading">Settings</h2>
          <p className="mt-1 text-sm leading-5 text-body-alt">
            Manage your account and application preferences.
          </p>
        </header>
        <div className="h-[0.5px] w-full bg-border" />

        <div className="flex flex-col gap-6 sm:flex-row sm:gap-16">
          <nav
            aria-label="Settings sections"
            className="flex h-9 gap-2 rounded-[8px] bg-muted p-0.5 sm:h-auto sm:w-[117px] sm:shrink-0 sm:flex-col sm:bg-transparent sm:p-0"
          >
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-current={tab === t.id ? 'page' : undefined}
                onClick={() => setTab(t.id)}
                className={cn(
                  'h-8 flex-1 whitespace-nowrap rounded-[8px] px-3 py-1.5 text-center text-sm leading-5 transition-colors sm:flex-none sm:text-left',
                  tab === t.id
                    ? 'bg-background font-medium text-foreground shadow-[0_20px_30px_-5px_rgba(0,0,0,0.05),0_8px_20px_-6px_rgba(0,0,0,0.05)] sm:bg-muted sm:shadow-none'
                    : 'text-body-alt hover:text-foreground',
                )}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <section className="min-w-0 flex-1">
            {tab === 'account' && <AccountTab email={session?.email ?? ''} />}
            {tab === 'preferences' && <PreferencesTab />}
            {tab === 'about' && <AboutTab />}
          </section>
        </div>
      </div>
    </BrokerShell>
  );
}
