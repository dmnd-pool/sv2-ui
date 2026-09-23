import { useQuery } from '@tanstack/react-query';
import { getUser } from '@/api';
import { useAuth } from '@/auth';
import {
  accountForAddress,
  payoutFromApi,
  sortPayoutsByDateDesc,
  MAIN_ACCOUNT_LABEL,
  type Payout,
  type PayoutAccount,
} from '@/lib/payoutsTable';
import { useAccountProfile, userBitcoinAddresses } from '@/hooks/useAccountData';
import { useSubaccountList } from '@/hooks/useSubaccounts';
import { subaccountName } from '@/lib/subaccountsTable';

const PAYOUTS_POLL_MS = 15 * 60 * 1000;

/**
 * Confirmed payouts for the selected account. The user endpoint returns the owner's
 * complete account tree, so main-account view keeps only the main profile's addresses;
 * a drilled-in subaccount uses the backend's exact per-subaccount endpoint.
 */
export function usePayouts(enabled = true) {
  const { session, viewingAccountId } = useAuth();
  const ownerAccountId = session?.accountId ?? null;
  const { data: profile } = useAccountProfile();
  return useQuery({
    queryKey: ['account', 'payouts', viewingAccountId ?? ownerAccountId],
    queryFn: async ({ signal }): Promise<Payout[]> => {
      const client = getUser();
      const req = { signal, accountId: ownerAccountId ?? undefined };
      const records = viewingAccountId
        ? await client.getSubaccountPayouts(viewingAccountId, {}, req)
        : await client.getPayouts({}, req);
      const mainAddresses = userBitcoinAddresses(profile);
      const scoped = viewingAccountId
        ? records
        : records.filter((row) => mainAddresses.has(row.address));
      return sortPayoutsByDateDesc(scoped.map(payoutFromApi));
    },
    enabled: enabled && !!session && (viewingAccountId !== null || !!profile),
    refetchInterval: PAYOUTS_POLL_MS,
    staleTime: PAYOUTS_POLL_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/**
 * Confirmed payouts across the main account and every subaccount. The backend returns
 * the account tree in one paginated response; local address ownership is used only to
 * supply the account label required by the existing table and filter.
 */
export function useAggregatedPayouts(enabled = true) {
  const { session } = useAuth();
  const ownerAccountId = session?.accountId ?? null;
  const { data: profile } = useAccountProfile();
  const { data: subs } = useSubaccountList();
  return useQuery({
    queryKey: ['account', 'payouts', 'aggregated', ownerAccountId],
    queryFn: async ({ signal }): Promise<Payout[]> => {
      const owners: PayoutAccount[] = [
        { name: MAIN_ACCOUNT_LABEL, addresses: userBitcoinAddresses(profile) },
        ...(subs ?? []).map((s) => ({
          name: subaccountName(s),
          addresses: new Set(Object.keys(s.bitcoin_addresses ?? {}).filter(Boolean)),
        })),
      ];
      const records = await getUser().getPayouts({}, {
        signal,
        accountId: ownerAccountId ?? undefined,
      });
      return sortPayoutsByDateDesc(
        records.map((record) => ({
          ...payoutFromApi(record),
          account: accountForAddress(record.address, owners) ?? undefined,
        })),
      );
    },
    enabled: enabled && !!session && !!profile && subs !== undefined,
    refetchInterval: PAYOUTS_POLL_MS,
    staleTime: PAYOUTS_POLL_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
