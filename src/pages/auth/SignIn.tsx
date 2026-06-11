import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, Redirect, useSearch } from 'wouter';
import { LiLetter } from 'solar-icon-react/li';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { AuthHeading } from '@/components/auth/AuthHeading';
import { FieldLabel, IconInput } from '@/components/auth/AuthField';
import { PasswordField } from '@/components/auth/PasswordField';
import { AuthSubmit } from '@/components/auth/AuthSubmit';
import { authErrorMessage } from '@/components/auth/authError';
import { useToast } from '@/components/ui/toast';
import { createSession, readNextParam, useAuth } from '@/auth';
import { signInSchema, type SignInValues } from '@/auth/schemas';
import { getDmndClient } from '@/dmnd';

export function SignIn() {
  const { session, signIn } = useAuth();
  const search = useSearch();
  const toast = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    mode: 'onChange',
    defaultValues: { email: '', password: '' },
  });

  // Already signed in (or just signed in): the redirect carries post-login nav.
  if (session) {
    return <Redirect to={readNextParam(search)} replace />;
  }

  const onSubmit = async (values: SignInValues) => {
    try {
      const account = await getDmndClient().login(values.email, values.password);
      toast({ type: 'success', message: 'Sign in successful' });
      signIn(
        createSession({ token: account.token, accountId: String(account.id), email: account.email }),
      );
    } catch (e) {
      toast({ type: 'error', message: authErrorMessage(e, 'Incorrect email or password.') });
    }
  };

  return (
    <AuthLayout
      topRight={
        <Link href="/broker/signin" className="text-xs text-link underline underline-offset-4 hover:opacity-80">
          Sign in as broker
        </Link>
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
            autoFocus
            placeholder="Enter your email address"
            {...register('email')}
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-1">
          <FieldLabel htmlFor="password" required>
            Password
          </FieldLabel>
          <PasswordField id="password" autoComplete="current-password" {...register('password')} />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          <div className="flex justify-end pt-0.5">
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
