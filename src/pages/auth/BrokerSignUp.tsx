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
import { useBrokerAuth } from '@/auth';
import {
  brokerSignUpDetailsSchema,
  type BrokerSignUpDetailsValues,
  brokerPasswordSchema,
  type BrokerPasswordValues,
} from '@/auth/schemas';
import { getDmndClient } from '@/api';

/**
 * Broker signup is two steps on one route: details, then password. Creating the
 * account lands on a success screen; the broker signs in from there (no auto-login).
 */
export function BrokerSignUp() {
  const { session } = useBrokerAuth();
  const [details, setDetails] = useState<BrokerSignUpDetailsValues | null>(null);
  const [created, setCreated] = useState(false);

  if (session) {
    return <Redirect to="/broker" replace />;
  }

  if (created) {
    return <BrokerSignUpSuccess />;
  }
  if (details === null) {
    return <DetailsStep onNext={setDetails} />;
  }
  return (
    <PasswordStep details={details} onBack={() => setDetails(null)} onCreated={() => setCreated(true)} />
  );
}

function DetailsStep({ onNext }: { onNext: (values: BrokerSignUpDetailsValues) => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<BrokerSignUpDetailsValues>({
    resolver: zodResolver(brokerSignUpDetailsSchema),
    mode: 'onChange',
    defaultValues: { firstName: '', lastName: '', email: '', companyName: '', companyLocation: '' },
  });

  return (
    <AuthLayout
      topRight={
        <Link href="/signup" className="text-xs text-link underline underline-offset-4 hover:opacity-80">
          Sign up as miner
        </Link>
      }
      marketing
    >
      <AuthHeading
        title="Start mining with DMND"
        subtitle="Enter your details below to create your broker account"
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
          <FieldLabel htmlFor="companyName" required>
            Company name
          </FieldLabel>
          <Input id="companyName" className={filledInputClass} placeholder="Enter your company name" {...register('companyName')} />
          {errors.companyName && <p className="text-xs text-destructive">{errors.companyName.message}</p>}
        </div>

        <div className="space-y-1">
          <FieldLabel htmlFor="companyLocation" required>
            Company location
          </FieldLabel>
          <Input
            id="companyLocation"
            className={filledInputClass}
            placeholder="Enter your company location"
            {...register('companyLocation')}
          />
          {errors.companyLocation && <p className="text-xs text-destructive">{errors.companyLocation.message}</p>}
        </div>

        <div className="h-px w-full bg-border" />

        <AuthSubmit type="submit" disabled={!isValid}>
          Continue
        </AuthSubmit>
      </form>

      <p className="mt-6 text-center text-xs text-body-alt">
        Already have an account?{' '}
        <Link href="/broker/signin" className="text-link underline underline-offset-4 hover:opacity-80">
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
  details: BrokerSignUpDetailsValues;
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
  } = useForm<BrokerPasswordValues>({
    resolver: zodResolver(brokerPasswordSchema),
    mode: 'onChange',
    defaultValues: { password: '', confirmPassword: '' },
  });
  const passwordValue = watch('password');
  const passwordReg = register('password');
  // Surface a server-side password rejection in the strength meter; clear it on edit.
  const [serverPwError, setServerPwError] = useState<string | null>(null);
  useEffect(() => setServerPwError(null), [passwordValue]);

  const onSubmit = async (values: BrokerPasswordValues) => {
    try {
      await getDmndClient().brokerSignup({
        email: details.email,
        password: values.password,
        firstName: details.firstName,
        lastName: details.lastName,
        companyName: details.companyName,
        companyLocation: details.companyLocation,
      });
    } catch (e) {
      const message = e instanceof DmndApiError ? e.message.trim() : '';
      if (/already exists/i.test(message)) {
        toast({ type: 'error', message: 'An account with this email already exists.' });
        return;
      }
      if (message) setServerPwError(message);
      else toast({ type: 'error', message: 'Unable to create account. Please try again.' });
      return;
    }
    toast({ type: 'success', message: 'Account created successfully.' });
    onCreated();
  };

  return (
    <AuthLayout
      onBack={onBack}
      topRight={
        <Link href="/signup" className="text-xs text-link underline underline-offset-4 hover:opacity-80">
          Sign up as miner
        </Link>
      }
      marketing
    >
      <AuthHeading title="Secure your account" subtitle="Create a password to protect your account." />

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
          <PasswordField
            id="confirmPassword"
            placeholder="Confirm your password"
            autoComplete="new-password"
            {...register('confirmPassword')}
          />
          {errors.confirmPassword && (
            <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
          )}
        </div>

        <div className="h-px w-full bg-border" />

        <AuthSubmit type="submit" loading={isSubmitting} disabled={!isValid}>
          Create account
        </AuthSubmit>
      </form>

      <p className="mt-6 text-center text-xs text-body-alt">
        Already have an account?{' '}
        <Link href="/broker/signin" className="text-link underline underline-offset-4 hover:opacity-80">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}

function BrokerSignUpSuccess() {
  const [, navigate] = useLocation();
  return (
    <AuthLayout onBack={() => navigate('/broker/signin')}>
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
        <AuthSubmit className="mt-2 w-auto px-8" onClick={() => navigate('/broker/signin')}>
          Go to sign in
        </AuthSubmit>
      </div>
    </AuthLayout>
  );
}
