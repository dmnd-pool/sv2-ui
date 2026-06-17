import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocation } from 'wouter';
import { Check } from 'lucide-react';
import { LiLetter, LiLock } from 'solar-icon-react/li';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { AuthHeading } from '@/components/auth/AuthHeading';
import { FieldLabel, IconInput, filledInputClass } from '@/components/auth/AuthField';
import { PasswordField } from '@/components/auth/PasswordField';
import { AuthSubmit } from '@/components/auth/AuthSubmit';
import { authErrorMessage } from '@/components/auth/authError';
import { useToast } from '@/components/ui/toast';
import { Input } from '@/components/ui/input';
import { OtpField } from '@/components/ui/input-otp';
import {
  emailSchema,
  type EmailValues,
  resetTokenSchema,
  type ResetTokenValues,
  resetPasswordSchema,
  type ResetPasswordValues,
} from '@/auth/schemas';
import { isTwoFactorRequiredError } from '@/auth/resetErrors';
import { DmndApiError, getDmndClient } from '@/api';

/**
 * Password recovery, one continuous in-app flow: email -> reset token -> new
 * password -> (2FA only if the backend requires it) -> done. The token is typed
 * in by hand from the email, so the flow no longer depends on the email link
 * returning to sv2-ui. reset_password takes all of {email, code, two_fa_token,
 * new_password}; we submit at the password step with an empty 2FA code and only
 * show the verify step if the backend says 2FA is needed.
 */
type Step = 'email' | 'token' | 'password' | 'twofa' | 'done';

export function ResetPassword() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');

  if (step === 'email') {
    return (
      <EmailStep
        onBack={() => navigate('/signin')}
        onNext={(value) => {
          setEmail(value);
          setStep('token');
        }}
      />
    );
  }

  if (step === 'token') {
    return (
      <TokenStep
        onBack={() => setStep('email')}
        onNext={(value) => {
          setToken(value);
          setStep('password');
        }}
      />
    );
  }

  if (step === 'password') {
    return (
      <PasswordStep
        email={email}
        token={token}
        onBack={() => setStep('token')}
        onDone={() => setStep('done')}
        onNeedTwoFactor={(pw) => {
          setNewPassword(pw);
          setStep('twofa');
        }}
      />
    );
  }

  if (step === 'twofa') {
    return (
      <TwoFactorStep
        email={email}
        token={token}
        newPassword={newPassword}
        onBack={() => setStep('password')}
        onDone={() => setStep('done')}
      />
    );
  }

  return <DoneStep onGoToSignIn={() => navigate('/signin')} />;
}

function EmailStep({ onBack, onNext }: { onBack: () => void; onNext: (email: string) => void }) {
  const toast = useToast();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting, isValid },
  } = useForm<EmailValues>({
    resolver: zodResolver(emailSchema),
    mode: 'onChange',
    defaultValues: { email: '' },
  });

  const emailValue = watch('email');
  useEffect(() => setServerError(null), [emailValue]);

  const onSubmit = async (values: EmailValues) => {
    setServerError(null);
    try {
      await getDmndClient().forgotPassword(values.email);
      toast({ type: 'success', message: 'Password reset link sent.' });
      onNext(values.email);
    } catch (e) {
      // An unknown email is a 4xx ('unknown'); show the designer's copy. Only
      // connectivity/server faults fall back to the generic message.
      if (e instanceof DmndApiError && e.code === 'unknown') {
        setServerError("This email doesn't have an account");
        toast({ type: 'error', message: "This email doesn't have an account" });
      } else {
        toast({ type: 'error', message: authErrorMessage(e) });
      }
    }
  };

  return (
    <AuthLayout onBack={onBack}>
      <AuthHeading
        title="Recover your password"
        subtitle="Enter your email and we'll send a link to reset your password."
      />

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
            autoFocus
            placeholder="Enter your email address"
            {...register('email')}
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          {serverError && <p className="text-xs text-destructive">{serverError}</p>}
        </div>

        <div className="h-px w-full bg-border" />

        <AuthSubmit type="submit" loading={isSubmitting} disabled={!isValid}>
          Send password reset link
        </AuthSubmit>
      </form>
    </AuthLayout>
  );
}

function TokenStep({ onBack, onNext }: { onBack: () => void; onNext: (token: string) => void }) {
  const {
    register,
    handleSubmit,
    formState: { isValid },
  } = useForm<ResetTokenValues>({
    resolver: zodResolver(resetTokenSchema),
    mode: 'onChange',
    defaultValues: { token: '' },
  });

  return (
    <AuthLayout onBack={onBack}>
      <div className="flex flex-col items-start space-y-3 lg:items-center">
        <LiLetter className="h-7 w-7 text-body-alt" />
        <AuthHeading
          title="We sent you a code"
          subtitle="We sent a password reset token to your email"
        />
      </div>

      <div className="my-6 h-px w-full bg-border" />

      <form onSubmit={handleSubmit((v) => onNext(v.token.trim()))} className="space-y-5" noValidate>
        <Input
          className={filledInputClass}
          autoFocus
          placeholder="Enter reset password token"
          aria-label="Reset password token"
          {...register('token')}
        />

        <div className="h-px w-full bg-border" />

        <AuthSubmit type="submit" disabled={!isValid}>
          Continue
        </AuthSubmit>
      </form>
    </AuthLayout>
  );
}

interface PasswordStepProps {
  email: string;
  token: string;
  onBack: () => void;
  onDone: () => void;
  onNeedTwoFactor: (newPassword: string) => void;
}

function PasswordStep({ email, token, onBack, onDone, onNeedTwoFactor }: PasswordStepProps) {
  const toast = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    mode: 'onChange',
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = async (values: ResetPasswordValues) => {
    // Try-then-ask: submit with no 2FA code; if the backend says 2FA is needed,
    // move to the verify step and resubmit there with the code.
    try {
      await getDmndClient().resetPassword(email, token, '', values.password);
      onDone();
    } catch (e) {
      if (isTwoFactorRequiredError(e)) {
        onNeedTwoFactor(values.password);
        return;
      }
      toast({ type: 'error', message: authErrorMessage(e, 'Unable to reset password. Please try again.') });
    }
  };

  return (
    <AuthLayout onBack={onBack}>
      <AuthHeading title="Create new password" subtitle="Create a new strong password for your account" />

      <div className="my-6 h-px w-full bg-border" />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <div className="space-y-1">
          <FieldLabel htmlFor="password" required>
            Password
          </FieldLabel>
          <PasswordField id="password" autoComplete="new-password" autoFocus {...register('password')} />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>

        <div className="space-y-1">
          <FieldLabel htmlFor="confirmPassword" required>
            Confirm password
          </FieldLabel>
          <PasswordField id="confirmPassword" autoComplete="new-password" {...register('confirmPassword')} />
          {errors.confirmPassword && (
            <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
          )}
        </div>

        <div className="h-px w-full bg-border" />

        <AuthSubmit type="submit" loading={isSubmitting} disabled={!isValid}>
          Reset password
        </AuthSubmit>
      </form>
    </AuthLayout>
  );
}

interface TwoFactorStepProps {
  email: string;
  token: string;
  newPassword: string;
  onBack: () => void;
  onDone: () => void;
}

function TwoFactorStep({ email, token, newPassword, onBack, onDone }: TwoFactorStepProps) {
  const toast = useToast();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (otp.length !== 6) return;
    setSubmitting(true);
    setError(false);
    try {
      await getDmndClient().resetPassword(email, token, otp, newPassword);
      onDone();
    } catch (e) {
      setError(true);
      toast({ type: 'error', message: authErrorMessage(e, 'Enter a valid 6-digit code.') });
      setOtp('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout onBack={onBack}>
      <div className="flex flex-col items-start space-y-3 lg:items-center">
        <LiLock className="h-7 w-7 text-body-alt" />
        <AuthHeading
          title="Let's verify it's you"
          subtitle="Enter your 6-digit authenticator code from your authenticator app"
        />
      </div>

      <div className="my-6 h-px w-full bg-border" />

      <div className="space-y-4">
        <OtpField
          value={otp}
          onChange={(v) => {
            setOtp(v);
            if (error) setError(false);
          }}
          onComplete={() => void submit()}
          disabled={submitting}
          error={error}
          ariaLabel="Authenticator code"
        />
        {error && (
          <p className="text-xs text-destructive">Invalid 6-digit code, please re-enter a new one.</p>
        )}
        <div className="h-px w-full bg-border" />
        <AuthSubmit disabled={otp.length !== 6 || submitting} loading={submitting} onClick={() => void submit()}>
          Continue
        </AuthSubmit>
      </div>
    </AuthLayout>
  );
}

function DoneStep({ onGoToSignIn }: { onGoToSignIn: () => void }) {
  return (
    <AuthLayout onBack={onGoToSignIn}>
      <div className="flex flex-col items-center space-y-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success">
          <Check className="h-6 w-6 text-white" />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold leading-9 tracking-[-1px] text-foreground">
            New password created
          </h1>
          <p className="text-xs font-light text-body-alt">
            Your new password has been created successfully
          </p>
        </div>
        <AuthSubmit className="mt-2 w-auto px-8" onClick={onGoToSignIn}>
          Go to Sign in
        </AuthSubmit>
      </div>
    </AuthLayout>
  );
}
