import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, Redirect, useLocation } from 'wouter';
import { Check } from 'lucide-react';
import { LiLetter } from 'solar-icon-react/li';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { AuthHeading } from '@/components/auth/AuthHeading';
import { FieldLabel, IconInput, filledInputClass } from '@/components/auth/AuthField';
import { PasswordField } from '@/components/auth/PasswordField';
import { PasswordStrengthMeter } from '@/components/auth/PasswordStrengthMeter';
import { SignupStepper } from '@/components/auth/SignupStepper';
import { AuthSubmit } from '@/components/auth/AuthSubmit';
import { useToast } from '@/components/ui/toast';
import { Input } from '@/components/ui/input';
import { DmndApiError } from '@/api';
import { useAuth } from '@/auth';
import {
  signUpDetailsSchema,
  type SignUpDetailsValues,
  signUpPasswordSchema,
  type SignUpPasswordValues,
} from '@/auth/schemas';
import { getDmndClient } from '@/api';

/**
 * Signup is two steps on one route: account details, then password. Creating the
 * account lands on a success screen; the user signs in from there (we don't
 * auto-login, so an account pending approval is handled gracefully).
 */
export function SignUp() {
  const { session } = useAuth();
  const [details, setDetails] = useState<SignUpDetailsValues | null>(null);
  const [created, setCreated] = useState(false);

  // A signed-in user has no business on the public signup route; the auth guard
  // takes over. Matches SignIn's redirect-on-session pattern.
  if (session) {
    return <Redirect to="/" replace />;
  }

  if (created) {
    return <SignUpSuccess />;
  }
  if (details === null) {
    return <DetailsStep onNext={setDetails} />;
  }
  return (
    <PasswordStep details={details} onBack={() => setDetails(null)} onCreated={() => setCreated(true)} />
  );
}

function DetailsStep({ onNext }: { onNext: (values: SignUpDetailsValues) => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<SignUpDetailsValues>({
    resolver: zodResolver(signUpDetailsSchema),
    mode: 'onChange',
    defaultValues: { firstName: '', lastName: '', email: '', companyName: '', companyLocation: '' },
  });

  return (
    <AuthLayout
      topRight={
        <Link href="/broker/signup" className="text-xs text-link underline underline-offset-4 hover:opacity-80">
          Sign up as broker
        </Link>
      }
      marketing
    >
      <AuthHeading
        title="Start mining with DMND"
        subtitle="Enter your details below to create your miner account"
      />

      <div className="my-6 h-px w-full bg-border" />

      <SignupStepper current="details" />

      <form onSubmit={handleSubmit(onNext)} className="mt-6 space-y-5" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <FieldLabel htmlFor="firstName" required>
              First name
            </FieldLabel>
            <Input id="firstName" className={filledInputClass} autoFocus placeholder="Enter first name" {...register('firstName')} />
            {errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}
          </div>
          <div className="space-y-1">
            <FieldLabel htmlFor="lastName" required>
              Last name
            </FieldLabel>
            <Input id="lastName" className={filledInputClass} placeholder="Enter last name" {...register('lastName')} />
            {errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}
          </div>
        </div>

        <div className="space-y-1">
          <FieldLabel htmlFor="email" required>
            Email address
          </FieldLabel>
          <IconInput
            id="email"
            icon={LiLetter}
            type="email"
            autoComplete="email"
            placeholder="Enter your email address"
            {...register('email')}
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-1">
          <FieldLabel htmlFor="companyName">Company name</FieldLabel>
          <Input id="companyName" className={filledInputClass} placeholder="Enter your company name" {...register('companyName')} />
        </div>

        <div className="space-y-1">
          <FieldLabel htmlFor="companyLocation">Company location</FieldLabel>
          <Input
            id="companyLocation"
            className={filledInputClass}
            placeholder="Enter your company location"
            {...register('companyLocation')}
          />
        </div>

        <div className="h-px w-full bg-border" />

        <AuthSubmit type="submit" disabled={!isValid}>
          Continue
        </AuthSubmit>
      </form>

      <p className="mt-6 text-center text-xs text-body-alt">
        Already have an account?{' '}
        <Link href="/signin" className="text-link underline underline-offset-4 hover:opacity-80">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}

function PasswordStep({
  details,
  onBack,
  onCreated,
}: {
  details: SignUpDetailsValues;
  onBack: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [passwordFocused, setPasswordFocused] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting, isValid },
  } = useForm<SignUpPasswordValues>({
    resolver: zodResolver(signUpPasswordSchema),
    mode: 'onChange',
    defaultValues: { password: '', confirmPassword: '', referralCode: '' },
  });
  const passwordValue = watch('password');
  const passwordReg = register('password');
  // A server-side password rejection (e.g. weak password) is shown through the
  // strength meter, not a separate line, and cleared as soon as the user edits.
  const [serverPwError, setServerPwError] = useState<string | null>(null);
  useEffect(() => setServerPwError(null), [passwordValue]);

  const onSubmit = async (values: SignUpPasswordValues) => {
    // Phase 1: create the account. Only signup failures are handled here, so a
    // later step (login/navigation) can never be misreported as a create error.
    try {
      await getDmndClient().signup({
        email: details.email,
        password: values.password,
        firstName: details.firstName,
        lastName: details.lastName,
        companyName: details.companyName?.trim() || undefined,
        companyLocation: details.companyLocation?.trim() || undefined,
        referralCode: values.referralCode?.trim() || undefined,
      });
    } catch (e) {
      const message = e instanceof DmndApiError ? e.message.trim() : '';
      // Existing email: show the notification and stop (don't silently sign in).
      // The user signs in via the link instead.
      if (/already exists/i.test(message)) {
        toast({ type: 'error', message: 'An account with this email already exists.' });
        return;
      }
      // Server validation (e.g. a weak password) is surfaced through the meter;
      // anything unrecognised falls back to a generic toast.
      if (message) setServerPwError(message);
      else toast({ type: 'error', message: 'Unable to create account. Please try again.' });
      return;
    }
    // Phase 2: account created. Show the success screen; the user signs in from
    // there. We deliberately don't auto-login.
    toast({ type: 'success', message: 'Account created successfully.' });
    onCreated();
  };

  return (
    <AuthLayout onBack={onBack} marketing>
      <AuthHeading title="Secure your account" subtitle="Create a password to protect your account" />

      <div className="my-6 h-px w-full bg-border" />

      <SignupStepper current="security" />

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-5" noValidate>
        <div className="space-y-1">
          <FieldLabel htmlFor="password" required>
            Password
          </FieldLabel>
          <PasswordField
            id="password"
            autoComplete="new-password"
            autoFocus
            {...passwordReg}
            onFocus={() => setPasswordFocused(true)}
            onBlur={(e) => {
              setPasswordFocused(false);
              void passwordReg.onBlur(e);
            }}
          />
          <PasswordStrengthMeter
            password={passwordValue}
            show={passwordFocused || passwordValue.length > 0}
            errorOverride={serverPwError}
          />
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

        <div className="space-y-1">
          <FieldLabel htmlFor="referralCode" optional>
            Referral code
          </FieldLabel>
          <Input
            id="referralCode"
            className={filledInputClass}
            placeholder="Enter referral code"
            {...register('referralCode')}
          />
        </div>

        <div className="h-px w-full bg-border" />

        <AuthSubmit type="submit" loading={isSubmitting} disabled={!isValid}>
          Create account
        </AuthSubmit>
      </form>

      <p className="mt-6 text-center text-xs text-body-alt">
        Already have an account?{' '}
        <Link href="/signin" className="text-link underline underline-offset-4 hover:opacity-80">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}

function SignUpSuccess() {
  const [, navigate] = useLocation();
  return (
    <AuthLayout onBack={() => navigate('/signin')}>
      <div className="flex flex-col items-center space-y-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success">
          <Check className="h-6 w-6 text-white" />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold leading-9 tracking-[-1px] text-foreground">
            Account created
          </h1>
          <p className="text-xs font-light text-body-alt">
            Your account has been created successfully
          </p>
        </div>
        <AuthSubmit className="mt-2 w-auto px-8" onClick={() => navigate('/signin')}>
          Go to sign in
        </AuthSubmit>
      </div>
    </AuthLayout>
  );
}
