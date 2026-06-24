import { Link } from 'wouter';
import { LiAltArrowRight } from 'solar-icon-react/li';

/**
 * Dashboard landing placeholder: a welcome and a prompt to finish account setup.
 * The full home (live hashrate, worker stats, performance chart) is not wired here yet.
 */
export function DashboardHome() {
  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold text-heading">Welcome back</h2>
        <p className="mt-1 text-sm text-body-alt">Here is an overview of your mining account.</p>
      </header>

      <Link
        href="/account-setup"
        className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-5 transition-colors hover:bg-muted"
      >
        <div>
          <p className="text-sm font-medium text-foreground">Finish setting up your account</p>
          <p className="mt-1 text-sm text-body-alt">
            Set up two-factor authentication and add your payout address.
          </p>
        </div>
        <LiAltArrowRight className="h-5 w-5 shrink-0 text-body-alt" />
      </Link>
    </div>
  );
}
