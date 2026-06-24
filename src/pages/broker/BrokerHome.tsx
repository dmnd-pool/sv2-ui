import { AuthLayout } from '@/components/auth/AuthLayout';
import { AuthHeading } from '@/components/auth/AuthHeading';
import { AuthSubmit } from '@/components/auth/AuthSubmit';
import { useBrokerAuth } from '@/auth';

/** Placeholder broker landing until the broker dashboard ships: account details and sign-out. */
export function BrokerHome() {
  const { session, signOut } = useBrokerAuth();

  return (
    <AuthLayout>
      <AuthHeading
        title="You're signed in"
        subtitle="The broker dashboard is coming in a later update."
      />

      <div className="my-6 h-px w-full bg-border" />

      <dl className="space-y-3 text-sm">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-body-alt">Email</dt>
          <dd className="text-foreground">{session?.email}</dd>
        </div>
        {session?.referenceCode && (
          <div className="flex items-center justify-between gap-4">
            <dt className="text-body-alt">Reference code</dt>
            <dd className="font-mono text-foreground">{session.referenceCode}</dd>
          </div>
        )}
      </dl>

      <div className="my-6 h-px w-full bg-border" />

      <AuthSubmit type="button" onClick={() => signOut()}>
        Sign out
      </AuthSubmit>
    </AuthLayout>
  );
}
