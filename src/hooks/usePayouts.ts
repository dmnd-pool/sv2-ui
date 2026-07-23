import { useQuery } from '@tanstack/react-query';
import { getDmndClient } from '@/api';
import { useAuth } from '@/auth';
import { fetchConfirmedTxsSince } from '@/lib/blockstream';
import {
  accountForAddress,
  buildPayouts,
  sortPayoutsByDateDesc,
  MAIN_ACCOUNT_LABEL,
  type Payout,
  type PayoutAccount,
} from '@/lib/payoutsTable';
import { useAccountProfile, userBitcoinAddresses } from '@/hooks/useAccountData';
import { useSubaccountList } from '@/hooks/useSubaccounts';
import { subaccountName } from '@/lib/subaccountsTable';

const PAYOUTS_POLL_MS = 15 * 60 * 1000;
// Cap how far back and how many pages we scan per wallet so a high-volume wallet
// can't loop unbounded.
const WINDOW_DAYS = 90;
const MAX_PAGES = 25;

/**
 * Assemble payouts on-chain: for each pool payout wallet (fpps + pplns), page its
 * recent confirmed transactions and keep the ones paying an address in `matchAddrs`,
 * one row per tx, newest first. Shared by the single-account and aggregated hooks so
 * both scan the pool wallets the same way; only which addresses count differs.
 */
async function fetchPayouts(matchAddrs: Set<string>, signal: AbortSignal | undefined): Promise<Payout[]> {
  if (matchAddrs.size === 0) return []; // no receiving address set -> no payouts to show
  const payout = await getDmndClient().getPayoutAddresses({ signal });
  const wallets: { addr: string; mode: 'fpps' | 'pplns' }[] = [];
  if (payout.fpps_payout_address) wallets.push({ addr: payout.fpps_payout_address, mode: 'fpps' });
  if (payout.pplns_payout_address && payout.pplns_payout_address !== payout.fpps_payout_address) {
    wallets.push({ addr: payout.pplns_payout_address, mode: 'pplns' });
  }
  if (wallets.length === 0) return [];
  const since = Math.floor(Date.now() / 1000) - WINDOW_DAYS * 24 * 60 * 60;
  const perWallet = await Promise.all(
    wallets.map(({ addr, mode }) =>
      fetchConfirmedTxsSince(addr, since, { signal, maxPages: MAX_PAGES }).then((txs) =>
        buildPayouts(txs, mode, addr, matchAddrs),
      ),
    ),
  );
  return sortPayoutsByDateDesc(perWallet.flat());
}

/**
 * The account's payouts, matched against the user's own receiving addresses. A failed
 * wallet fetch rejects the query (the page shows an error) rather than a misleadingly
 * partial list.
 */
export function usePayouts() {
  const { session } = useAuth();
  const { data: profile } = useAccountProfile();
  return useQuery({
    queryKey: ['account', 'payouts'],
    queryFn: ({ signal }): Promise<Payout[]> => fetchPayouts(userBitcoinAddresses(profile), signal),
    enabled: !!session && !!profile,
    refetchInterval: PAYOUTS_POLL_MS,
    staleTime: PAYOUTS_POLL_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/**
 * Payouts across the main account and every subaccount, each row tagged with the
 * account it was paid to. Scans the same pool wallets but matches against the union of
 * every account's receiving addresses; attribution lists the main account first, so a
 * receiving address shared across accounts is credited to the main account rather than
 * guessing a split. Its own cache entry keeps it from mixing with the single-account
 * query when a miner toggles aggregated mode.
 */
export function useAggregatedPayouts(enabled = true) {
  const { session } = useAuth();
  const { data: profile } = useAccountProfile();
  const { data: subs } = useSubaccountList();
  return useQuery({
    queryKey: ['account', 'payouts', 'aggregated'],
    queryFn: async ({ signal }): Promise<Payout[]> => {
      const owners: PayoutAccount[] = [
        { name: MAIN_ACCOUNT_LABEL, addresses: userBitcoinAddresses(profile) },
        ...(subs ?? []).map((s) => ({
          name: subaccountName(s),
          addresses: new Set(Object.keys(s.bitcoin_addresses ?? {})),
        })),
      ];
      const union = new Set<string>();
      for (const owner of owners) for (const addr of owner.addresses) union.add(addr);
      const rows = await fetchPayouts(union, signal);
      return rows.map((row) => ({ ...row, account: accountForAddress(row.toAddress, owners) ?? undefined }));
    },
    enabled: enabled && !!session && !!profile && subs !== undefined,
    refetchInterval: PAYOUTS_POLL_MS,
    staleTime: PAYOUTS_POLL_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
