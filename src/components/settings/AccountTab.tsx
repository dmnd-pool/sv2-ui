import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { LiCopy, LiCheckCircle, LiClockCircle } from 'solar-icon-react/li';
import { useAccountProfile, userBitcoinAddresses } from '@/hooks/useAccountData';
import { truncateMiddle } from '@/lib/payoutsTable';
import { ChangeBitcoinAddressModal } from './ChangeBitcoinAddressModal';

// The session does not yet carry the miner's name or company (tracked server-side by
// issue #14); until it does, the profile fields show placeholder values so the section
// keeps its designed shape. Editing profile info is not allowed for now, so the fields
// are read-only (no Save button); swap these for the real values, and the KYB status,
// once the account endpoint returns them.
const PROFILE_PLACEHOLDER = {
  firstName: 'John',
  lastName: 'Doe',
  companyName: 'DMND Mining Ltd',
  companyLocation: 'Lisbon, PT',
};

/** A labelled read-only field styled like the other settings inputs. */
function ReadonlyField({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <span className="text-sm text-body-alt">{label}</span>
      <div className="rounded-2xl border border-border bg-muted px-4 py-2.5 text-sm text-foreground">{value}</div>
      {children}
    </div>
  );
}

function CopyAddressButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label="Copy address"
      onClick={() => {
        void navigator.clipboard?.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="shrink-0 rounded-lg border border-border p-2 text-body-alt transition-colors hover:text-foreground"
    >
      {copied ? <LiCheckCircle className="h-4 w-4 text-success" /> : <LiCopy className="h-4 w-4" />}
    </button>
  );
}

/**
 * The Account tab. For now it surfaces the payout Bitcoin address (the one account
 * detail the API lets a miner change); profile name/company are read-only server-side
 * and not yet returned by the session, so that block is intentionally omitted until
 * the backend exposes it.
 */
export function AccountTab() {
  const { data: profile, isLoading, isError } = useAccountProfile();
  const queryClient = useQueryClient();
  const [changing, setChanging] = useState(false);

  const addresses = profile ? [...userBitcoinAddresses(profile)] : [];

  return (
    <div className="max-w-2xl space-y-10">
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-heading">Profile</h2>
          <p className="mt-1 text-sm text-body-alt">Manage your personal information and company details</p>
        </div>
        <div className="h-px w-full bg-border" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ReadonlyField label="First name" value={PROFILE_PLACEHOLDER.firstName} />
          <ReadonlyField label="Last name" value={PROFILE_PLACEHOLDER.lastName} />
        </div>
        <ReadonlyField label="Company name" value={PROFILE_PLACEHOLDER.companyName}>
          <span className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-warning">
            <LiClockCircle className="h-3.5 w-3.5" />
            KYB verification is in review
          </span>
        </ReadonlyField>
        <ReadonlyField label="Company location" value={PROFILE_PLACEHOLDER.companyLocation} />
      </div>

      <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-heading">Bitcoin address</h2>
        <p className="mt-1 text-sm text-body-alt">This is the address you receive your mining payouts.</p>
      </div>
      <div className="h-px w-full bg-border" />

      {isLoading ? (
        <div className="h-12 animate-pulse rounded-2xl bg-muted" />
      ) : isError ? (
        <p className="text-sm text-body-alt">Couldn't load your account details. Please try again.</p>
      ) : addresses.length === 0 ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-body-alt">You haven't set a payout address yet.</p>
          <button
            type="button"
            onClick={() => setChanging(true)}
            className="rounded-full bg-[hsl(var(--btn))] px-5 py-2 text-sm font-medium text-[hsl(var(--btn-foreground))] transition-opacity hover:opacity-90"
          >
            Add address
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <span className="text-sm text-body-alt">Bitcoin address</span>
          <div className="flex items-center gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-border bg-muted px-4 py-2.5">
              <span className="min-w-0 flex-1 truncate font-mono text-sm text-foreground" title={addresses[0]}>
                {truncateMiddle(addresses[0], 10, 8)}
              </span>
              <CopyAddressButton value={addresses[0]} />
            </div>
            <button
              type="button"
              onClick={() => setChanging(true)}
              className="shrink-0 rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Change
            </button>
          </div>
        </div>
      )}
      </div>

      {changing && (
        <ChangeBitcoinAddressModal
          onClose={() => setChanging(false)}
          onSaved={() => void queryClient.invalidateQueries({ queryKey: ['account', 'profile'] })}
        />
      )}
    </div>
  );
}
