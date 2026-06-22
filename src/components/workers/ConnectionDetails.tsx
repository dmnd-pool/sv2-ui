import { useAccountProfile } from '@/hooks/useAccountData';
import { POOL_URL, POOL_USERNAME_HINT } from '@/lib/poolConnection';
import { CredentialRow } from '@/components/home/CredentialRow';

/** The pool credentials a miner points hardware at, sourced from the account.
 * Shared by the workers empty state and the Connect-worker modal. */
export function ConnectionDetails() {
  const { data: account, isLoading } = useAccountProfile();

  return (
    <div className="divide-y divide-border">
      <CredentialRow label="Pool URL" value={POOL_URL} hint="Point your miner's pool / stratum URL here." />
      <CredentialRow label="Username" value={POOL_USERNAME_HINT} copyable={false} />
      <CredentialRow label="PPLNS Password" value={account?.token ?? ''} secret loading={isLoading} />
      <CredentialRow label="FPPS Password" value={account?.fpps_token ?? ''} secret loading={isLoading} />
    </div>
  );
}
