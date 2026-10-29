import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { LiCopy, LiCheckCircle } from 'solar-icon-react/li';
import { useAuth } from '@/auth';
import { activeBitcoinAddress, useAccountProfile } from '@/hooks/useAccountData';
import { useAccountScope } from '@/hooks/useAccountScope';
import { truncateMiddle } from '@/lib/payoutsTable';
import { ChangeBitcoinAddressModal } from './ChangeBitcoinAddressModal';

/** A labelled read-only field styled like the other settings inputs. */
function ReadonlyField({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm leading-5 text-body-alt">{label}</span>
      <div className="flex h-10 items-center rounded-[16px] bg-muted px-4 py-2 text-sm leading-5 text-foreground">
        {value}
      </div>
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

export function AccountTab() {
  const { session, viewingAccount } = useAuth();
  const { data: profile, isLoading, isError } = useAccountProfile();
  const queryClient = useQueryClient();
  const [changing, setChanging] = useState(false);
  // The payout address of a subaccount is the master's to set; the pool reports this as
  // `edit_btc_address: false` on the subaccount's own permissions, so the control stays
  // visible (it is part of the design) but cannot be used.
  const { canEditBitcoinAddress, viewingSubaccount } = useAccountScope();

  const payoutAddress = activeBitcoinAddress(profile);
  const accountDetails = viewingAccount ?? session;

  return (
    <div className="max-w-[542px] space-y-8 sm:space-y-12">
      <div className="space-y-3">
        <div>
          <h2 className="!font-body text-base font-semibold leading-6 text-heading">Profile</h2>
          <p className="mt-1 text-sm text-body-alt">Review your account and company details</p>
        </div>
        <div className="h-[0.5px] w-full bg-border" />
        {accountDetails && (
          <>
            {!viewingSubaccount && <ReadonlyField label="Email" value={accountDetails.email ?? ''} />}
            <ReadonlyField label="Company name" value={accountDetails.company_name?.trim() || 'Not provided'}>
            </ReadonlyField>
            <ReadonlyField
              label="Company location"
              value={accountDetails.company_primary_location?.trim() || 'Not provided'}
            />
          </>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="!font-body text-base font-semibold leading-6 text-heading">Payout address</h2>
          <p className="mt-1 text-sm text-body-alt">This is the address you receive your payouts.</p>
        </div>
        <div className="h-[0.5px] w-full bg-border" />

        {isLoading ? (
          <div className="h-12 animate-pulse rounded-2xl bg-muted" />
        ) : isError ? (
          <p className="text-sm text-body-alt">Couldn't load your account details. Please try again.</p>
        ) : !payoutAddress ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-body-alt">You haven't set a payout address yet.</p>
            <button
              type="button"
              onClick={() => setChanging(true)}
              disabled={!canEditBitcoinAddress}
              className="rounded-full bg-[hsl(var(--btn))] px-5 py-2 text-sm font-medium text-[hsl(var(--btn-foreground))] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Add address
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            <span className="text-sm text-body-alt">Bitcoin address</span>
            <div className="flex items-center gap-3">
              <div className="flex h-10 min-w-0 flex-1 items-center gap-3 rounded-[16px] bg-muted px-4 py-2">
                <span className="min-w-0 flex-1 truncate text-sm leading-5 text-foreground" title={payoutAddress}>
                  {truncateMiddle(payoutAddress, 10, 8)}
                </span>
                <CopyAddressButton value={payoutAddress} />
              </div>
              <button
                type="button"
                onClick={() => setChanging(true)}
                disabled={!canEditBitcoinAddress}
                className="inline-flex h-10 shrink-0 items-center rounded-[32px] border-[0.5px] border-black/20 bg-btn-secondary px-5 text-sm leading-5 text-foreground transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-30"
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
