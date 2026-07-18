import { useState } from 'react';
import { LiCloseCircle, LiClipboard, LiDangerTriangle } from 'solar-icon-react/li';
import { OtpField } from '@/components/ui/input-otp';
import { FieldLabel, filledInputClass } from '@/components/auth/AuthField';
import { Input } from '@/components/ui/input';
import { authErrorMessage } from '@/components/auth/authError';
import { isTwoFactorRequiredError } from '@/auth/resetErrors';
import { useToast } from '@/components/ui/toast';
import { getDmndClient } from '@/api';
import { getBitcoinAddressError } from '@/lib/utils';

type Step = 'address' | 'code';

/**
 * A right-side drawer to change the payout Bitcoin address. Two steps: enter the new
 * address (validated client-side), then a 2FA code. `POST /api/bitcoin_address`
 * hard-requires a current TOTP, so the code is mandatory; the single save call
 * carries both the address and the code. A bad code keeps the drawer open with the
 * code cleared so the user can retry without re-entering the address.
 */
export function ChangeBitcoinAddressModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [step, setStep] = useState<Step>('address');
  const [address, setAddress] = useState('');
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const addressError = address ? getBitcoinAddressError(address, 'mainnet') : null;
  const addressValid = !!address && !addressError;

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setAddress(text.trim());
    } catch {
      toast({ type: 'error', message: "Couldn't read from clipboard" });
    }
  };

  const save = async () => {
    if (code.length !== 6 || submitting || !addressValid) return;
    setSubmitting(true);
    try {
      await getDmndClient().setBitcoinAddress(address, code);
      toast({ type: 'success', message: 'Bitcoin address saved' });
      onSaved();
      onClose();
    } catch (e) {
      // A bad/expired code is the 2FA-token error; anything else is address/server.
      if (isTwoFactorRequiredError(e)) {
        setCodeError(true);
        setCode('');
        toast({ type: 'error', message: "That code didn't match. Try again." });
      } else {
        toast({ type: 'error', message: authErrorMessage(e, "Couldn't save your address. Please try again.") });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-label="Change bitcoin address"
        className="relative flex max-h-full w-full max-w-[472px] flex-col overflow-y-auto border-b border-l border-border bg-popover shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 p-6">
          <div>
            <h2 className="text-lg font-semibold text-heading">Change bitcoin address</h2>
            <p className="mt-1 text-sm text-body-alt">Enter a new bitcoin address to receive your payouts.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 text-placeholder transition-colors hover:text-foreground"
          >
            <LiCloseCircle className="h-6 w-6" />
          </button>
        </div>

        <div className="flex flex-col gap-5 px-6 pb-6">
          {step === 'address' ? (
            <>
              <div className="space-y-1">
                <FieldLabel htmlFor="new-btc-address">Bitcoin address</FieldLabel>
                <Input
                  id="new-btc-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Enter new bitcoin address"
                  className={filledInputClass}
                  autoComplete="off"
                  spellCheck={false}
                />
                {addressError && <p className="text-xs text-destructive">{addressError}</p>}
                <div className="flex justify-end pt-0.5">
                  <button
                    type="button"
                    onClick={() => void paste()}
                    className="inline-flex items-center gap-1 text-xs text-link underline-offset-4 hover:underline"
                  >
                    Paste address <LiClipboard className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex gap-2.5 rounded-lg bg-toast-warning p-3.5">
                <LiDangerTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Double check address</p>
                  <p className="mt-0.5 text-xs text-body-alt">
                    Bitcoin payments sent to the wrong address cannot be recovered by anyone, including DMND Pool.
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={!addressValid}
                onClick={() => setStep('code')}
                className="rounded-full bg-[hsl(var(--btn))] px-5 py-2.5 text-sm font-medium text-[hsl(var(--btn-foreground))] transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                Continue
              </button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <FieldLabel>Enter 6-digit code from your authenticator app</FieldLabel>
                <OtpField
                  value={code}
                  onChange={(v) => {
                    setCode(v);
                    if (codeError) setCodeError(false);
                  }}
                  onComplete={() => void save()}
                  disabled={submitting}
                  error={codeError}
                  ariaLabel="Authenticator code"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep('address')}
                  disabled={submitting}
                  className="rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={code.length !== 6 || submitting}
                  onClick={() => void save()}
                  className="flex-1 rounded-full bg-[hsl(var(--btn))] px-5 py-2.5 text-sm font-medium text-[hsl(var(--btn-foreground))] transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {submitting ? 'Saving...' : 'Save address'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
