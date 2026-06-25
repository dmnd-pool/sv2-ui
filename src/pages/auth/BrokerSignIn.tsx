import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, Redirect } from 'wouter';
import { LiLetter } from 'solar-icon-react/li';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { AuthHeading } from '@/components/auth/AuthHeading';
import { FieldLabel, IconInput } from '@/components/auth/AuthField';
import { PasswordField } from '@/components/auth/PasswordField';
import { AuthSubmit } from '@/components/auth/AuthSubmit';
import { authErrorMessage } from '@/components/auth/authError';
import { useToast } from '@/components/ui/toast';
import { signInSchema, type SignInValues } from '@/auth/schemas';
import { createBrokerSession, useBrokerAuth } from '@/auth';
import { getDmndClient } from '@/api';

export function BrokerSignIn() {
  const { session, signIn } = useBrokerAuth();
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

  if (session) {
    return <Redirect to="/broker" replace />;
  }

  const onSubmit = async (values: SignInValues) => {
    try {
      const broker = await getDmndClient().brokerLogin(values.email, values.password);
      toast({ type: 'success', message: 'Sign in successful' });
      signIn(
        createBrokerSession({
          brokerId: String(broker.id),
          email: broker.email,
          referenceCode: broker.referenceCode,
        }),
      );
    } catch (e) {
      toast({ type: 'error', message: authErrorMessage(e, 'Incorrect email or password.') });
    }
  };

  return (
    <AuthLayout
      topRight={
        <Link href="/signin" className="text-xs text-link underline underline-offset-4 hover:opacity-80">
          Sign in as miner
        </Link>
      }
      marketing
    >
      <AuthHeading title="Welcome back" subtitle="Enter your details to access your broker account" />

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
        <Link href="/broker/signup" className="text-link underline underline-offset-4 hover:opacity-80">
          Sign up
        </Link>
      </p>
    </AuthLayout>
  );
}
