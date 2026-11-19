import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation } from 'wouter';
import { LiUserId, LiKeyMinimalistic } from 'solar-icon-react/li';
import { BdEye } from 'solar-icon-react/bd';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { AuthHeading } from '@/components/auth/AuthHeading';
import { FieldLabel, IconInput } from '@/components/auth/AuthField';
import { PasswordField } from '@/components/auth/PasswordField';
import { AuthSubmit } from '@/components/auth/AuthSubmit';
import { watcherSignInSchema, type WatcherSignInValues } from '@/auth/schemas';
import { watcherLinkUrl } from '@/lib/watcherLinks';

/**
 * Watcher sign-in: the third way into the app, beside the miner and broker screens.
 *
 * A Watcher link is normally opened directly, but a watcher who was sent the credentials
 * as text -- or who has the link in a password manager rather than a browser -- needs a
 * way to type them in. So this screen collects the account ID and token and hands them
 * to the same /login/watcher/:userId/:token view the shared link opens.
 *
 */
export function WatcherSignIn() {
  const [, navigate] = useLocation();

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<WatcherSignInValues>({
    resolver: zodResolver(watcherSignInSchema),
    mode: 'onChange',
    defaultValues: { userId: '', token: '' },
  });

  const onSubmit = ({ userId, token }: WatcherSignInValues) => {
    navigate(watcherLinkUrl('', userId, token));
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
      <AuthHeading
        title="Watcher sign in"
        subtitle="Enter the account ID and token from your Watcher link"
      />

      <div className="my-6 h-px w-full bg-border" />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <div className="space-y-1">
          <FieldLabel htmlFor="watcher-account" required>
            Account ID
          </FieldLabel>
          <IconInput
            id="watcher-account"
            icon={LiUserId}
            type="text"
            autoComplete="off"
            spellCheck={false}
            autoFocus
            placeholder="Enter the account ID"
            {...register('userId')}
          />
          {errors.userId && <p className="text-xs text-destructive">{errors.userId.message}</p>}
        </div>

        <div className="space-y-1">
          <FieldLabel htmlFor="watcher-token" required>
            Watcher token
          </FieldLabel>
          <PasswordField
            id="watcher-token"
            icon={LiKeyMinimalistic}
            revealLabel="watcher token"
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste your watcher token"
            {...register('token')}
          />
          {errors.token && <p className="text-xs text-destructive">{errors.token.message}</p>}
        </div>

        <div className="h-px w-full bg-border" />

        <AuthSubmit type="submit" disabled={!isValid}>
          Open Watcher view
        </AuthSubmit>
      </form>

      <div className="mt-6 flex items-start gap-2 rounded-2xl bg-muted px-4 py-3">
        <BdEye className="mt-0.5 h-4 w-4 shrink-0 text-body-alt" />
        <p className="text-xs leading-4 text-body-alt">
          A Watcher view is read-only. You can see whatever the link's owner shared with you, and nothing else
        </p>
      </div>
    </AuthLayout>
  );
}
