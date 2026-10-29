import { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { LiCloseCircle, LiCopy } from 'solar-icon-react/li';
import { OtpField } from '@/components/ui/input-otp';
import { authErrorMessage } from '@/components/auth/authError';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/auth';
import { buildResetOtpAuthUri } from '@/auth/otpauth';
import { getUser, isAuthenticatorCodeError } from '@/api';
import { useAccountProfile } from '@/hooks/useAccountData';

type Phase = 'menu' | 'loading' | 'setup' | 'confirm';

/**
 * The "Manage 2FA" drawer for an account that already has 2FA active. There is no
 * disable endpoint, so this offers RESET rather than disable: it fetches a fresh secret
 * from /new_2fa, shows a new QR, and
 * re-activates with a 6-digit code (which overwrites the old secret). The provisioning
 * secret is read once when Reset is pressed and never refetched between the QR and
 * activation, so the code the user scans matches the one the server will check.
 */
export function Manage2faModal({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const { session } = useAuth();
  const [phase, setPhase] = useState<Phase>('menu');
  const [currentCode, setCurrentCode] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [secret, setSecret] = useState('');
  const [addedAt, setAddedAt] = useState<Date | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const profile = useAccountProfile();
  const [challenged, setChallenged] = useState(false);
  const twoFaEnabled = challenged || profile.data?.two_factor_secret === null;
  const currentCodeReady = profile.isSuccess && (!twoFaEnabled || /^\d{6}$/.test(currentCode));
  const stepNumber = phase === 'confirm' ? 3 : phase === 'setup' ? 2 : 1;

  const startReset = async () => {
    if (!currentCodeReady || phase === 'loading') return;
    setResetError(null);
    setPhase('loading');
    try {
      const account = await getUser().newTwoFactor({ totpToken: twoFaEnabled ? currentCode : undefined });
      if (account.two_factor_secret == null) {
        // The reset endpoint should always return a secret; if it doesn't, fail
        // visibly rather than showing an empty QR.
        setResetError('Could not start the 2FA reset. Please try again.');
        setPhase('menu');
        return;
      }
      setSecret(account.two_factor_secret);
      setAddedAt(new Date());
      // A profile refresh during setup must not drop the existing-factor challenge.
      if (twoFaEnabled) setChallenged(true);
      // Scanning takes time; do not silently reuse the code from the first request.
      setCurrentCode('');
      setCode('');
      setError(false);
      setPhase('setup');
    } catch (e) {
      if (isAuthenticatorCodeError(e)) setChallenged(true);
      setResetError(authErrorMessage(e, 'Enter the current authenticator code to reset 2FA.'));
      setPhase('menu');
    }
  };

  const uri = useMemo(
    () => (secret && addedAt ? buildResetOtpAuthUri(secret, session?.email ?? '', addedAt) : ''),
    [secret, session?.email, addedAt],
  );

  const submit = async () => {
    if (!/^\d{6}$/.test(code) || submitting || !currentCodeReady) return;
    setSubmitting(true);
    setResetError(null);
    try {
      await getUser().activate2fa(code, { totpToken: twoFaEnabled ? currentCode : undefined });
      toast({ type: 'success', message: 'Two-factor authentication updated' });
      onChanged();
      onClose();
    } catch (e) {
      if (isAuthenticatorCodeError(e)) {
        // The API uses the same rejection for either factor. Do not blame just the new code.
        setError(true);
        setCurrentCode('');
        setCode('');
        setResetError('A code is incorrect or has expired. Enter the latest code from each entry and try again.');
      } else {
        setResetError(authErrorMessage(e, 'Could not confirm the reset. Please try again.'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[8px]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-label="Manage two-factor authentication"
        className="relative flex max-h-full w-full max-w-[472px] flex-col overflow-y-auto bg-background shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)]"
      >
        <div className="flex items-start justify-between gap-4 p-6 sm:p-8">
          <div>
            <p className="mb-1 text-xs text-body-alt">Step {stepNumber} of 3</p>
            <h2 className="text-lg font-semibold text-heading">
              {phase === 'confirm' ? 'Confirm your new authenticator' : phase === 'setup' ? 'Add your new authenticator' : 'Reset two-factor authentication'}
            </h2>
            <p className="mt-1 text-sm text-body-alt">
              {phase === 'setup'
                ? 'Scan this QR code to add a separate DMND entry. Keep your existing entry until the reset is complete.'
                : phase === 'confirm'
                  ? 'Enter the codes currently shown in both entries. Your existing code approves the change; your new code confirms the setup works.'
                  : 'First, enter the code from your existing DMND entry to confirm it’s you.'}
            </p>
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
          {profile.isLoading && <p className="text-sm text-body-alt">Checking 2FA status...</p>}
          {profile.isError && <p className="text-sm text-destructive">Unable to check 2FA status. <button type="button" className="underline" onClick={() => void profile.refetch()}>Retry</button></p>}
          {resetError && <p role="alert" className="text-sm text-destructive">{resetError}</p>}
          {(phase === 'menu' || phase === 'loading') && (
            <>
              {twoFaEnabled && <div className="space-y-2">
                <p className="text-sm text-body-alt">Current authenticator code</p>
                <OtpField value={currentCode} onChange={setCurrentCode} disabled={phase === 'loading'} ariaLabel="Current authenticator code" autoFocus />
              </div>}
              <button
                type="button"
                disabled={phase === 'loading' || !currentCodeReady}
                onClick={() => void startReset()}
                className="inline-flex h-11 w-full items-center justify-center rounded-[32px] border border-black/20 bg-[hsl(var(--btn))] px-6 text-base leading-6 text-[hsl(var(--btn-foreground))] transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {phase === 'loading' ? 'Checking...' : 'Continue'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-11 w-full items-center justify-center rounded-[32px] border border-black/20 bg-btn-secondary px-6 text-base leading-6 text-foreground transition-opacity hover:opacity-80"
              >
                Close
              </button>
            </>
          )}

          {phase === 'setup' && (
            <>
              <div className="flex flex-wrap items-center gap-5">
                <div className="inline-flex rounded-xl bg-white p-3">
                  <QRCodeSVG value={uri} size={128} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-body-alt">Can&apos;t scan? Use this setup key:</p>
                  <div className="mt-2 flex items-center gap-2">
                    <code className="truncate rounded-lg bg-muted px-3 py-1.5 text-xs text-foreground">{secret}</code>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard?.writeText(secret);
                        toast({ type: 'success', message: 'Setup key copied' });
                      }}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
                    >
                      Copy <LiCopy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setCurrentCode('');
                  setCode('');
                  setError(false);
                  setResetError(null);
                  setPhase('confirm');
                }}
                className="inline-flex h-11 w-full items-center justify-center rounded-[32px] border border-black/20 bg-[hsl(var(--btn))] px-6 text-base leading-6 text-[hsl(var(--btn-foreground))] transition-opacity hover:opacity-90"
              >
                I&apos;ve added the new entry
              </button>
            </>
          )}

          {phase === 'confirm' && (
            <>
              {twoFaEnabled && <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Current authenticator code</p>
                <p className="text-xs text-body-alt">Use the latest code from the authenticator app you used before this reset.</p>
                <OtpField
                  value={currentCode}
                  onChange={(value) => { setCurrentCode(value); setError(false); }}
                  disabled={submitting}
                  error={error}
                  ariaLabel="Current authenticator code"
                  autoFocus
                />
              </div>}

              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">New authenticator code</p>
                <p className="text-xs text-body-alt">Use the 6-digit code generated after scanning the QR code.</p>
                <OtpField
                  value={code}
                  onChange={(v) => {
                    setCode(v);
                    if (error) setError(false);
                  }}
                  disabled={submitting}
                  error={error}
                  ariaLabel="New authenticator code"
                />
              </div>

              <button
                type="button"
                disabled={!/^\d{6}$/.test(code) || submitting || !currentCodeReady}
                onClick={() => void submit()}
                className="inline-flex h-11 w-full items-center justify-center rounded-[32px] border border-black/20 bg-[hsl(var(--btn))] px-6 text-base leading-6 text-[hsl(var(--btn-foreground))] transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {submitting ? 'Updating...' : 'Confirm reset'}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => { setResetError(null); setPhase('setup'); }}
                className="self-center text-sm text-body-alt underline underline-offset-4 hover:text-foreground disabled:opacity-40"
              >
                Back to QR code
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
