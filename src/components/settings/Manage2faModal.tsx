import { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { LiCloseCircle, LiCopy, LiShieldCheck } from 'solar-icon-react/li';
import { OtpField } from '@/components/ui/input-otp';
import { authErrorMessage } from '@/components/auth/authError';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/auth';
import { buildOtpAuthUri } from '@/auth/otpauth';
import { getDmndClient } from '@/api';

type Phase = 'menu' | 'loading' | 'setup' | 'error';

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
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const startReset = async () => {
    setPhase('loading');
    try {
      const account = await getDmndClient().newTwoFactor();
      if (account.two_factor_secret == null) {
        // The reset endpoint should always return a secret; if it doesn't, fail
        // visibly rather than showing an empty QR.
        setPhase('error');
        return;
      }
      setSecret(account.two_factor_secret);
      setPhase('setup');
    } catch {
      setPhase('error');
    }
  };

  const uri = useMemo(
    () => (secret ? buildOtpAuthUri(secret, session?.email ?? '') : ''),
    [secret, session?.email],
  );

  const submit = async () => {
    if (code.length !== 6 || submitting) return;
    setSubmitting(true);
    try {
      await getDmndClient().activate2fa(code);
      toast({ type: 'success', message: 'Two-factor authentication updated' });
      onChanged();
      onClose();
    } catch (e) {
      setError(true);
      setCode('');
      toast({ type: 'error', message: authErrorMessage(e, 'Enter a valid 6-digit code.') });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-label="Manage two-factor authentication"
        className="relative flex max-h-full w-full max-w-[472px] flex-col overflow-y-auto border-b border-l border-border bg-popover shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 p-6">
          <div>
            <h2 className="text-lg font-semibold text-heading">Manage 2FA</h2>
            <p className="mt-1 text-sm text-body-alt">
              {phase === 'setup'
                ? 'Scan the new QR code with your authenticator app, then enter the 6-digit code.'
                : 'Your account two-factor authentication.'}
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
          {(phase === 'menu' || phase === 'loading') && (
            <>
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-2">
                  <LiShieldCheck className="h-4 w-4 text-success" />
                  <span className="text-sm text-foreground">2FA is enabled</span>
                </span>
                <button
                  type="button"
                  disabled={phase === 'loading'}
                  onClick={() => void startReset()}
                  className="shrink-0 rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-40"
                >
                  {phase === 'loading' ? 'Loading...' : 'Reset 2FA'}
                </button>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full bg-[hsl(var(--btn))] px-5 py-2.5 text-sm font-medium text-[hsl(var(--btn-foreground))] transition-opacity hover:opacity-90"
              >
                Close
              </button>
            </>
          )}

          {phase === 'error' && (
            <p className="text-sm text-body-alt">Couldn&apos;t start the 2FA reset. Please try again.</p>
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

              <div className="space-y-2">
                <span className="text-sm text-body-alt">Enter the 6-digit code from your app</span>
                <OtpField
                  value={code}
                  onChange={(v) => {
                    setCode(v);
                    if (error) setError(false);
                  }}
                  onComplete={() => void submit()}
                  disabled={submitting}
                  error={error}
                  ariaLabel="Authenticator code"
                />
              </div>

              <button
                type="button"
                disabled={code.length !== 6 || submitting}
                onClick={() => void submit()}
                className="rounded-full bg-[hsl(var(--btn))] px-5 py-2.5 text-sm font-medium text-[hsl(var(--btn-foreground))] transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {submitting ? 'Updating...' : 'Reset 2FA'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
