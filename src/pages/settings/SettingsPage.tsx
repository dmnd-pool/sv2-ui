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
          {tab === 'account' && <AccountTab />}
          {tab === 'security' && <SecurityTab />}
          {tab === 'preferences' && <PreferencesTab />}
          {tab === 'about' && <AboutTab />}
        </section>
      </div>
    </div>
  );
}
