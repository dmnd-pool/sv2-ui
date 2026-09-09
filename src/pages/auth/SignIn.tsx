import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, Redirect, useLocation, useSearch } from 'wouter';
import { LiLetter, LiLock } from 'solar-icon-react/li';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { AuthHeading } from '@/components/auth/AuthHeading';
import { FieldLabel, IconInput } from '@/components/auth/AuthField';
import { PasswordField } from '@/components/auth/PasswordField';
import { AuthSubmit } from '@/components/auth/AuthSubmit';
import { AuthCheckbox } from '@/components/auth/AuthCheckbox';
import { InfoHint } from '@/components/ui/InfoHint';
import { OtpField } from '@/components/ui/input-otp';
import { authErrorMessage } from '@/components/auth/authError';
import { useToast } from '@/components/ui/toast';
import {
  clearRememberedEmail,
  createSession,
  readNextParam,
  readRememberedEmail,
  useAuth,
  writeRememberedEmail,
} from '@/auth';
import { minerSignInSchema, type MinerSignInValues } from '@/auth/schemas';
import { isTwoFactorLoginRequiredError } from '@/auth/loginErrors';
import { getUser, type DmndSession } from '@/api';

export function SignIn() {
  const { session, signIn } = useAuth();
  const [, navigate] = useLocation();
  const search = useSearch();
  const toast = useToast();
  const [pendingTwoFactor, setPendingTwoFactor] = useState<MinerSignInValues | null>(null);

  // A previous "Remember me" sign-in leaves its email behind, so the form offers it back
  // and starts with the box ticked. It says nothing about that session still being
  // valid -- only which address to pre-fill.
  const [rememberedEmail] = useState(readRememberedEmail);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<MinerSignInValues>({
    resolver: zodResolver(minerSignInSchema),
    mode: 'onChange',
    defaultValues: { email: rememberedEmail ?? '', password: '', remember: rememberedEmail !== null },
  });

  // Already signed in (or just signed in): the redirect carries post-login nav,
  // defaulting to the dashboard home.
  if (session) {
    return <Redirect to={readNextParam(search, '/home')} replace />;
  }

  const finishSignIn = (account: DmndSession, values: MinerSignInValues) => {
    if (values.remember) writeRememberedEmail(values.email);
    else clearRememberedEmail();
    toast({ type: 'success', message: 'Sign in successful' });
    signIn(
      createSession({
        accountId: String(account.id),
        email: account.email,
        company_name: account.company_name,
        company_primary_location: account.company_primary_location,
        kyb_status: account.kyb_status,
        remember: values.remember,
      }),
    );
    navigate(readNextParam(search, '/home'), { replace: true });
  };

  const onSubmit = async (values: MinerSignInValues) => {
    try {
      finishSignIn(await getUser().login(values.email, values.password), values);
    } catch (e) {
      if (isTwoFactorLoginRequiredError(e)) {
        // Keep credentials only in this mounted component long enough to finish
        // the challenge. They never enter storage or the URL.
        setPendingTwoFactor(values);
      } else {
        toast({ type: 'error', message: authErrorMessage(e, 'Incorrect email or password.') });
      }
    }
  };

  if (pendingTwoFactor) {
    return (
      <TwoFactorSignIn
        credentials={pendingTwoFactor}
        onBack={() => setPendingTwoFactor(null)}
        onSuccess={finishSignIn}
      />
    );
  }

  return (
    <AuthLayout
      topRight={
        <>
          <Link href="/broker/signin" className="text-xs text-link underline underline-offset-4 hover:opacity-80">
            Sign in as broker
          </Link>
          <Link href="/watcher/signin" className="text-xs text-link underline underline-offset-4 hover:opacity-80">
            Open watcher view
          </Link>
        </>
      }
      marketing
    >
      <AuthHeading title="Welcome back" subtitle="Enter your details to access your miner account" />

      <div className="my-6 h-px w-full bg-border" />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <div className="space-y-1">
          <FieldLabel htmlFor="email" required>
            Email address
          </FieldLabel>
          <IconInput
            id="email"
            icon={LiLetter}
            type="email"
            autoComplete="email"
            autoFocus={rememberedEmail === null}
            placeholder="Enter your email address"
            {...register('email')}
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-1">
          <FieldLabel htmlFor="password" required>
            Password
          </FieldLabel>
          <PasswordField
            id="password"
            autoComplete="current-password"
            autoFocus={rememberedEmail !== null}
            {...register('password')}
          />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          <div className="flex items-center justify-between gap-4 pt-2.5">
            <div className="flex items-center gap-1.5">
              <AuthCheckbox id="remember" label="Remember me" {...register('remember')} />
              <InfoHint size="sm" text="Keeps you signed in on this browser for 7 days." />
            </div>
            <Link href="/forgot-password" className="text-xs text-link underline-offset-4 hover:underline">
              Forgot password?
            </Link>
          </div>
        </div>

        <div className="h-px w-full bg-border" />

        <AuthSubmit type="submit" loading={isSubmitting} disabled={!isValid}>
          Sign in
        </AuthSubmit>
      </form>

      <p className="mt-6 text-center text-xs text-body-alt">
        Don't have an account?{' '}
        <Link href="/signup" className="text-link underline underline-offset-4 hover:opacity-80">
          Sign up
        </Link>
      </p>
    </AuthLayout>
  );
}

interface TwoFactorSignInProps {
  credentials: MinerSignInValues;
  onBack: () => void;
  onSuccess: (account: DmndSession, credentials: MinerSignInValues) => void;
}

function TwoFactorSignIn({ credentials, onBack, onSuccess }: TwoFactorSignInProps) {
  const toast = useToast();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (completedCode = otp) => {
    if (completedCode.length !== 6 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const account = await getUser().login(
        credentials.email,
        credentials.password,
        completedCode,
      );
      onSuccess(account, credentials);
    } catch (e) {
      const message = isTwoFactorLoginRequiredError(e)
        ? 'Invalid 6-digit code.'
        : authErrorMessage(e, 'Incorrect email or password. Please check your credentials.');
      setError(message);
      setOtp('');
      toast({ type: 'error', message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout onBack={onBack} marketing>
      <div className="flex flex-col items-start space-y-3 lg:items-center">
        <LiLock className="h-7 w-7 text-body-alt" />
        <AuthHeading
          title="Let's verify it's you"
          subtitle="Enter the 6-digit code from your authenticator app"
        />
      </div>

      <div className="my-6 h-px w-full bg-border" />

      <div className="space-y-4">
        <OtpField
          value={otp}
          onChange={(value) => {
            setOtp(value);
            if (error) setError(null);
          }}
          onComplete={(code) => void submit(code)}
          disabled={submitting}
          error={error !== null}
          ariaLabel="Authenticator code"
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="h-px w-full bg-border" />
        <AuthSubmit
          type="button"
          disabled={otp.length !== 6 || submitting}
          loading={submitting}
          onClick={() => void submit()}
        >
          Continue
        </AuthSubmit>
      </div>
    </AuthLayout>
  );
}
