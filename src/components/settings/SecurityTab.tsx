import { useAuth } from '@/auth';

/**
 * The Security tab: email (read-only), password, and two-factor authentication.
 * Password and 2FA management are added in the following commits; this first cut
 * shows the read-only email the account signs in with.
 */
export function SecurityTab() {
  const { session } = useAuth();

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h2 className="text-base font-semibold text-heading">Email address</h2>
        <p className="mt-1 text-sm text-body-alt">Your primary email for signing in and account notifications.</p>
      </div>
      <div className="h-px w-full bg-border" />
      <div className="space-y-1.5">
        <span className="text-sm text-body-alt">Email address</span>
        <div className="rounded-2xl border border-border bg-muted px-4 py-2.5 text-sm text-foreground">
          {session?.email ?? '--'}
        </div>
      </div>
    </div>
  );
}
