import { useAuth } from '@/auth';
import { usePermissions } from './useSubaccounts';

/**
 * What the account currently in view is allowed to do.
 *
 * The capability flags come from `GET /api/user/permissions`, which the pool scopes to
 * the active account: a subaccount is returned `view_sub_accounts: false` and
 * `edit_btc_address: false` (verified live), so these are the backend's own rules
 * rather than an assumption made here. Switching accounts drops the cached permissions
 * along with the rest of the account's data, so they are refetched for the new scope.
 *
 * Each flag reads "permitted unless we have been told otherwise", so a master keeps its
 * controls during the brief window before permissions load rather than flickering.
 * `viewingSubaccount` is the session-level fact (are we drilled into a subaccount at
 * all), used for the restrictions the API exposes no flag for.
 */
export function useAccountScope() {
  const { viewingAccountId } = useAuth();
  const { data: permissions } = usePermissions();
  return {
    viewingSubaccount: viewingAccountId !== null,
    canViewSubaccounts: permissions?.view_sub_accounts !== false,
    canEditBitcoinAddress: permissions?.edit_btc_address !== false,
  };
}
