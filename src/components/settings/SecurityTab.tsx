import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { LiLockPassword, LiShieldCheck, LiShieldKeyhole } from 'solar-icon-react/li';
import { useAuth } from '@/auth';
import { useAccountProfile } from '@/hooks/useAccountData';
import { Enable2faModal } from './Enable2faModal';
import { Manage2faModal } from './Manage2faModal';

function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-heading">{title}</h2>
        <p className="mt-1 text-sm text-body-alt">{subtitle}</p>
      </div>
      <div className="h-px w-full bg-border" />
    </div>
  );
}

/**
 * The Security tab: the sign-in email (read-only), password, and two-factor
 * authentication. 2FA state comes from the profile (a null `two_factor_secret` means
 * it is active). Enabling opens the QR flow; an active account can Manage 2FA to reset
 * it (there is no disable endpoint, so the design's Disable is a Reset here). The
 * Change password button is present but not wired: it must not link to the recovery
 * flow, and the dedicated reset-password endpoint does not exist yet.
 */
export function SecurityTab() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useAccountProfile();
  const [enabling, setEnabling] = useState(false);
  const [managing, setManaging] = useState(false);

  const twoFaEnabled = !!profile && profile.two_factor_secret == null;
  const refreshProfile = () => void queryClient.invalidateQueries({ queryKey: ['account', 'profile'] });

  return (
    <div className="max-w-2xl space-y-10">
      <div className="space-y-4">
        <SectionHeading
          title="Email address"
          subtitle="Your primary email for signing in and account notifications."
        />
        <div className="space-y-1.5">
          <span className="text-sm text-body-alt">Email address</span>
          <div className="rounded-2xl border border-border bg-muted px-4 py-2.5 text-sm text-foreground">
            {session?.email ?? '--'}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <SectionHeading title="Password" subtitle="Manage your password" />
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2 text-body-alt">
            <LiLockPassword className="h-4 w-4" />
            <span className="tracking-widest">........</span>
          </span>
          {/* Present per the design but disabled: the recovery flow must not be used
              for this (per review), and the dedicated reset-password endpoint is not
              available yet. Wire it up once that endpoint exists. */}
          <button
            type="button"
            disabled
            title="Password reset is coming soon"
            className="shrink-0 rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          >
            Change password
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <SectionHeading
          title="Two-factor authentication"
          subtitle="Two-factor authentication adds an extra layer of security to your account."
        />
        {isLoading ? (
          <div className="h-10 animate-pulse rounded-lg bg-muted" />
        ) : twoFaEnabled ? (
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2">
              <LiShieldCheck className="h-4 w-4 text-success" />
              <span className="text-sm text-foreground">2FA is enabled</span>
            </span>
            <button
              type="button"
              onClick={() => setManaging(true)}
              className="shrink-0 rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Manage
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-body-alt">
              <LiShieldKeyhole className="h-4 w-4" />
              <span className="text-sm">2FA is not enabled</span>
            </span>
            <button
              type="button"
              onClick={() => setEnabling(true)}
              className="shrink-0 rounded-full bg-[hsl(var(--btn))] px-5 py-2.5 text-sm font-medium text-[hsl(var(--btn-foreground))] transition-opacity hover:opacity-90"
            >
              Enable
            </button>
          </div>
        )}
      </div>

      {enabling && <Enable2faModal onClose={() => setEnabling(false)} onEnabled={refreshProfile} />}
      {managing && <Manage2faModal onClose={() => setManaging(false)} onChanged={refreshProfile} />}
    </div>
  );
}
