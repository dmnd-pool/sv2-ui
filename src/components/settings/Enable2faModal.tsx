import { useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { LiCloseCircle, LiCopy } from 'solar-icon-react/li';
import { OtpField } from '@/components/ui/input-otp';
import { authErrorMessage } from '@/components/auth/authError';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/auth';
import { buildOtpAuthUri } from '@/auth/otpauth';
import { getDmndClient } from '@/api';

type Phase = 'loading' | 'ready' | 'error';

/**
 * A drawer to enable 2FA from Settings. The provisioning secret rotates on every
 * authed call, so it is read once via a fresh checkAuth on open and never refetched
 * between showing the QR and activating (the same constraint the onboarding flow
 * has). On success the caller refreshes the profile so the tab flips to "enabled".
 */
export function Enable2faModal({ onClose, onEnabled }: { onClose: () => void; onEnabled: () => void }) {
  const toast = useToast();
  const { session } = useAuth();
  const [phase, setPhase] = useState<Phase>('loading');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // one-shot even under StrictMode's double-invoke
    ran.current = true;
    getDmndClient()
      .checkAuth()
      .then((acc) => {
        // A null secret means 2FA is already active; nothing to enable.
        if (acc.two_factor_secret == null) {
          onEnabled();
          onClose();
          return;
        }
        setSecret(acc.two_factor_secret);
        setPhase('ready');
      })
      .catch(() => setPhase('error'));
  }, [onClose, onEnabled]);

  const uri = useMemo(
    () => (secret ? buildOtpAuthUri(secret, session?.email ?? '') : ''),
    [secret, session?.email],
  );

  const submit = async () => {
    if (code.length !== 6 || submitting) return;
    setSubmitting(true);
    try {
      await getDmndClient().activate2fa(code);
      toast({ type: 'success', message: 'Two-factor authentication enabled' });
      onEnabled();
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
        aria-label="Enable two-factor authentication"
        className="relative flex max-h-full w-full max-w-[472px] flex-col overflow-y-auto border-b border-l border-border bg-popover shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 p-6">
          <div>
            <h2 className="text-lg font-semibold text-heading">Enable two-factor authentication</h2>
            <p className="mt-1 text-sm text-body-alt">
              Scan the QR code with your authenticator app, then enter the 6-digit code.
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
          {phase === 'loading' && <p className="text-sm text-body-alt">Loading...</p>}
          {phase === 'error' && (
            <p className="text-sm text-body-alt">Couldn't start 2FA setup. Please try again.</p>
          )}
          {phase === 'ready' && (
            <>
              <div className="flex flex-wrap items-center gap-5">
                <div className="inline-flex rounded-xl bg-white p-3">
                  <QRCodeSVG value={uri} size={128} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-body-alt">Can't scan? Use this setup key:</p>
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
                {submitting ? 'Enabling...' : 'Enable 2FA'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
