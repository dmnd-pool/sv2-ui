import { useState } from 'react';
import { cn } from '@/lib/utils';
import { AccountTab } from '@/components/settings/AccountTab';
import { SecurityTab } from '@/components/settings/SecurityTab';
import { PreferencesTab } from '@/components/settings/PreferencesTab';
import { AboutTab } from '@/components/settings/AboutTab';

type SettingsTab = 'account' | 'security' | 'preferences' | 'about';

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'account', label: 'Account' },
  { id: 'security', label: 'Security' },
  { id: 'preferences', label: 'Preferences' },
  { id: 'about', label: 'About' },
];

/**
 * The account Settings page: a tabbed shell over Account, Security, Preferences and
 * About. The tab rail is a vertical left column on desktop and a horizontal scroller
 * on mobile. Each tab is a self-contained section so its data and mutations stay
 * isolated from the others.
 */
export function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('account');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-heading">Settings</h1>
        <p className="mt-1 text-sm text-body-alt">Manage your account, security, and application preferences.</p>
      </header>
      <div className="h-px w-full bg-border" />

      <div className="flex flex-col gap-6 sm:flex-row sm:gap-10">
        <nav
          aria-label="Settings sections"
          className="-mx-1 flex gap-1 overflow-x-auto px-1 sm:mx-0 sm:w-44 sm:shrink-0 sm:flex-col sm:overflow-visible sm:px-0"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-current={tab === t.id ? 'page' : undefined}
              onClick={() => setTab(t.id)}
              className={cn(
                'shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors',
                tab === t.id ? 'bg-muted text-foreground' : 'text-body-alt hover:text-foreground',
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <section className="min-w-0 flex-1 sm:border-l sm:border-border sm:pl-8 lg:pl-10">
          {tab === 'account' && <AccountTab />}
          {tab === 'security' && <SecurityTab />}
          {tab === 'preferences' && <PreferencesTab />}
          {tab === 'about' && <AboutTab />}
        </section>
      </div>
    </div>
  );
}
