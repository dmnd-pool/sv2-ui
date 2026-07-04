import { LiAltArrowRight } from 'solar-icon-react/li';
import { useAccountProfile } from '@/hooks/useAccountData';
import { POOL_URL, POOL_USERNAME_HINT } from '@/lib/poolConnection';
import { CredentialRow } from './CredentialRow';

// Empty until the setup tutorial URL is available; the link renders only when set.
const SETUP_TUTORIAL_URL = '';

/** The credentials a miner points hardware at: pool URL, username, and the two
 * scheme passwords (PPLNS = account token, FPPS = fpps token). */
export function ConnectWorkersCard() {
  const { data: account, isLoading } = useAccountProfile();

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-heading">Connect workers</h3>
        {SETUP_TUTORIAL_URL ? (
          <a
            href={SETUP_TUTORIAL_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-body-alt transition-colors hover:text-foreground"
          >
            Setup tutorial
            <LiAltArrowRight className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </div>
      <div className="mt-2 divide-y divide-border">
        <CredentialRow label="Pool URL" value={POOL_URL} hint="Point your miner's pool / stratum URL here." />
        <CredentialRow label="Username" value={POOL_USERNAME_HINT} copyable={false} />
        <CredentialRow label="PPLNS Password" value={account?.token ?? ''} secret loading={isLoading} />
        <CredentialRow label="FPPS Password" value={account?.fpps_token ?? ''} secret loading={isLoading} />
      </div>
    </div>
  );
}
