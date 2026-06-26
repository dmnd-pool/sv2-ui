import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { QRCodeSVG } from 'qrcode.react';
import { Check } from 'lucide-react';
import { LiCopy, LiClipboard, LiDangerTriangle } from 'solar-icon-react/li';
import { AccountSetupLayout, type AccountSetupStep } from '@/components/account-setup/AccountSetupLayout';
import { OtpField } from '@/components/ui/input-otp';
import { AuthSubmit } from '@/components/auth/AuthSubmit';
import { FieldLabel, filledInputClass } from '@/components/auth/AuthField';
import { Input } from '@/components/ui/input';
import { authErrorMessage } from '@/components/auth/authError';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/auth';
import { buildOtpAuthUri } from '@/auth/otpauth';
import { isTwoFactorRequiredError } from '@/auth/resetErrors';
import { getDmndClient } from '@/api';
import type { DmndSession } from '@/api/types';
import { getBitcoinAddressError } from '@/lib/utils';
import { POOL_URL, POOL_USERNAME_HINT } from '@/lib/poolConnection';
import { CredentialRow } from '@/components/home/CredentialRow';

/** A payout address counts as set whether the API returns an array or a map. */
function hasBitcoinAddress(account: DmndSession): boolean {
  const addrs = account.bitcoin_addresses;
  if (Array.isArray(addrs)) return addrs.length > 0;
  if (addrs && typeof addrs === 'object') return Object.keys(addrs).length > 0;
  return false;
}

/** A non-null `two_factor_secret` means 2FA is provisioned but not yet activated. */
function initialStep(account: DmndSession): AccountSetupStep {
  if (account.two_factor_secret != null) return 'twofa';
  if (!hasBitcoinAddress(account)) return 'bitcoin';
  return 'done';
}

/**
 * The "Complete account" flow reached from the home setup prompt: set up 2FA,
 * add a payout address, then connect workers. The account state is read once on
 * mount (the 2FA secret rotates on every authed call, so we must not refetch
 * between showing the QR and activating).
 */
export function AccountSetup() {
  const [, navigate] = useLocation();
  const { session } = useAuth();
  const [account, setAccount] = useState<DmndSession | null>(null);
  const [step, setStep] = useState<AccountSetupStep | null>(null);
  const [loadError, setLoadError] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // one-shot, even under StrictMode's double-invoke
    ran.current = true;
    getDmndClient()
      .checkAuth()
      .then((acc) => {
        setAccount(acc);
        setStep(initialStep(acc));
      })
      .catch(() => setLoadError(true));
  }, []);

  const goHome = () => navigate('/home');

  if (loadError) {
    return (
      <AccountSetupLayout current="twofa" onBack={goHome}>
        <h1 className="text-2xl font-semibold tracking-[-0.5px] text-heading">Couldn't load your account</h1>
        <p className="mt-2 text-sm text-body-alt">Please try again from your dashboard.</p>
        <div className="mt-6">
          <AuthSubmit className="w-auto px-8" onClick={goHome}>
            Back to dashboard
          </AuthSubmit>
        </div>
      </AccountSetupLayout>
    );
  }

  if (step === null) {
    return (
      <AccountSetupLayout current="twofa" onBack={goHome}>
        <p className="text-sm text-body-alt">Loading your account...</p>
      </AccountSetupLayout>
    );
  }

  return (
    <AccountSetupLayout current={step} onBack={goHome}>
      {step === 'twofa' && account && (
        <Setup2faStep
          secret={account.two_factor_secret ?? ''}
          email={session?.email ?? account.email}
          onDone={() => setStep('bitcoin')}
        />
      )}
      {step === 'bitcoin' && <BitcoinStep onDone={() => setStep('connect')} />}
      {step === 'connect' && account && (
        <ConnectWorkersStep
          token={account.token}
          fppsToken={account.fpps_token ?? ''}
          onDone={() => setStep('done')}
        />
      )}
      {step === 'done' && <AllSetStep onGoToDashboard={goHome} />}
    </AccountSetupLayout>
  );
}

function StepHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold tracking-[-0.5px] text-heading">{title}</h1>
      <p className="text-sm text-body-alt">{subtitle}</p>
    </div>
  );
}

function NumberBadge({ n }: { n: number }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground">
      {n}
    </span>
  );
}

function Setup2faStep({ secret, email, onDone }: { secret: string; email: string; onDone: () => void }) {
  const toast = useToast();
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);
  const uri = useMemo(() => buildOtpAuthUri(secret, email), [secret, email]);

  const copyKey = () => {
    void navigator.clipboard?.writeText(secret);
    toast({ type: 'success', message: 'Setup key copied' });
  };

  const submit = async () => {
    if (code.length !== 6 || submitting) return;
    setSubmitting(true);
    try {
      await getDmndClient().activate2fa(code);
      onDone();
    } catch (e) {
      setError(true);
      setCode('');
      toast({ type: 'error', message: authErrorMessage(e, 'Enter a valid 6-digit code.') });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <StepHeading
        title="Set up 2FA"
        subtitle="Follow the steps below to protect your account and mining rewards if your password is ever compromised."
      />
      <div className="h-px w-full bg-border" />

      <div className="flex gap-3">
        <NumberBadge n={1} />
        <div>
          <p className="text-sm font-medium text-foreground">Download an authenticator app</p>
          <p className="mt-0.5 text-xs text-body-alt">
            <a href="https://support.google.com/accounts/answer/1066447" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              Google Authenticator
            </a>{' '}
            or{' '}
            <a href="https://authy.com/download/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              Authy
            </a>{' '}
            work great. Available on iOS and Android.
          </p>
        </div>
      </div>
      <div className="h-px w-full bg-border" />

      <div className="flex gap-3">
        <NumberBadge n={2} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">Scan QR code with authenticator app</p>
          <p className="mt-0.5 text-xs text-body-alt">Open your authenticator app and scan the QR code below</p>
          <div className="mt-4 flex flex-wrap items-center gap-5">
            <div className="inline-flex rounded-xl bg-white p-3">
              <QRCodeSVG value={uri} size={128} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-body-alt">Can't scan? Use the setup key to manually configure your app:</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="truncate rounded-lg bg-muted px-3 py-1.5 text-xs text-foreground">{secret}</code>
                <button
                  type="button"
                  onClick={copyKey}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
                >
                  Copy <LiCopy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="h-px w-full bg-border" />

      <div className="flex gap-3">
        <NumberBadge n={3} />
        <div className="min-w-0 flex-1">
          <p className="mb-3 text-sm font-medium text-foreground">Enter the 6-digit code from your app</p>
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
      </div>
      <div className="h-px w-full bg-border" />

      <AuthSubmit disabled={code.length !== 6 || submitting} loading={submitting} onClick={() => void submit()}>
        Continue
      </AuthSubmit>
    </div>
  );
}

function BitcoinStep({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const [address, setAddress] = useState('');
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const addressError = address ? getBitcoinAddressError(address, 'mainnet') : null;
  const addressValid = !!address && !addressError;
  // 2FA is set up in the step before this one, and POST /api/bitcoin_address
  // hard-requires a current TOTP, so the code is required to save (matches the
  // design, which shows the field inline rather than revealing it on failure).
  const canSave = addressValid && code.length === 6 && !submitting;

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setAddress(text.trim());
    } catch {
      toast({ type: 'error', message: "Couldn't read from clipboard" });
    }
  };

  const save = async () => {
    if (!canSave) return;
    setSubmitting(true);
    try {
      await getDmndClient().setBitcoinAddress(address, code);
      toast({ type: 'success', message: 'Bitcoin address saved' });
      onDone();
    } catch (e) {
      // A bad/expired code comes back as the 2FA-token error; anything else is
      // an address/server problem, so don't blame the code field for it.
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
    <div className="space-y-5">
      <StepHeading
        title="Bitcoin address"
        subtitle="Add a Bitcoin address to receive your mining rewards. You can change this later in Settings."
      />
      <div className="h-px w-full bg-border" />

      <div className="space-y-1">
        <FieldLabel htmlFor="btc-address">Bitcoin address</FieldLabel>
        <Input
          id="btc-address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Enter your bitcoin address"
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

      {/* Irreversibility warning — payments to a wrong address can't be recovered. */}
      <div className="flex gap-2.5 rounded-lg bg-toast-warning p-3.5">
        <LiDangerTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <div>
          <p className="text-sm font-semibold text-foreground">Double check address</p>
          <p className="mt-0.5 text-xs text-body-alt">
            Bitcoin payments sent to the wrong address cannot be recovered by anyone, including DMND Pool.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <FieldLabel>Enter 6-digit code from your authenticator app</FieldLabel>
        <OtpField
          value={code}
          onChange={(v) => {
            setCode(v);
            if (codeError) setCodeError(false);
          }}
          disabled={submitting}
          error={codeError}
          ariaLabel="Authenticator code"
        />
      </div>

      <div className="h-px w-full bg-border" />

      <AuthSubmit disabled={!canSave} loading={submitting} onClick={() => void save()}>
        Save address
      </AuthSubmit>
    </div>
  );
}

/**
 * Final gate step: the pool credentials the miner points hardware at (the same
 * values as the home connect-workers card). It's informational, so both Skip and
 * Continue finish the account setup. Tokens come from the account loaded on mount.
 */
function ConnectWorkersStep({
  token,
  fppsToken,
  onDone,
}: {
  token: string;
  fppsToken: string;
  onDone: () => void;
}) {
  return (
    <div className="space-y-5">
      <StepHeading
        title="Connect workers"
        subtitle="Point your mining hardware at the pool with these credentials. You can find them again on your dashboard."
      />
      <div className="h-px w-full bg-border" />

      <div className="rounded-xl bg-muted px-4">
        <div className="divide-y divide-border">
          <CredentialRow label="Pool URL" value={POOL_URL} hint="Point your miner's pool / stratum URL here." />
          <CredentialRow label="Username" value={POOL_USERNAME_HINT} copyable={false} />
          <CredentialRow label="PPLNS Password" value={token} secret />
          <CredentialRow label="FPPS Password" value={fppsToken} secret />
        </div>
      </div>

      <div className="h-px w-full bg-border" />

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onDone}
          className="shrink-0 text-sm font-medium text-foreground underline-offset-4 hover:underline"
        >
          Skip
        </button>
        {/* Wrapper flexes; AuthSubmit keeps its own w-full inside it (flex-1 on the
            button itself fights its w-full and overflows the row). */}
        <div className="min-w-0 flex-1">
          <AuthSubmit onClick={onDone}>Continue</AuthSubmit>
        </div>
      </div>
    </div>
  );
}

function AllSetStep({ onGoToDashboard }: { onGoToDashboard: () => void }) {
  return (
    <div className="flex flex-col items-center space-y-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/15">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-success">
          <Check className="h-5 w-5 text-white" />
        </span>
      </div>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-[-0.5px] text-heading">You're all set!</h1>
        <p className="max-w-sm text-sm text-body-alt">
          Your miners can now connect and start earning payouts. Let's show you around your mining dashboard.
        </p>
      </div>
      <AuthSubmit className="mt-2 w-auto px-8" onClick={onGoToDashboard}>
        Go to dashboard
      </AuthSubmit>
    </div>
  );
}
