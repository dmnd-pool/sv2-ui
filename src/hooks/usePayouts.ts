import { useQuery } from '@tanstack/react-query';
import { getDmndClient } from '@/api';
import { useAuth } from '@/auth';
import { fetchConfirmedTxsSince } from '@/lib/blockstream';
import { buildPayouts, sortPayoutsByDateDesc, type Payout } from '@/lib/payoutsTable';
import { useAccountProfile, userBitcoinAddresses } from '@/hooks/useAccountData';

const PAYOUTS_POLL_MS = 15 * 60 * 1000;
// The pool payout wallets are shared (they pay many miners), so scanning their full
// on-chain history for this user's payouts is unbounded. Cap the window + pages; the
// Blockstream path is temporary (a pool-wallet API replaces it), so we don't over-fetch.
const WINDOW_DAYS = 90;
const MAX_PAGES = 25;

/**
 * The account's payouts, assembled on-chain: for each pool payout wallet (fpps +
 * pplns), page its recent confirmed transactions and keep the ones paying one of the
 * user's own addresses, one row per tx. A failed wallet fetch rejects the query (the
 * page shows an error) rather than a misleadingly-partial list. Newest first.
 */
export function usePayouts() {
  const { session } = useAuth();
  const { data: profile } = useAccountProfile();
  return useQuery({
    queryKey: ['account', 'payouts'],
    queryFn: async ({ signal }): Promise<Payout[]> => {
      const userAddrs = userBitcoinAddresses(profile);
      if (userAddrs.size === 0) return []; // no receiving address set -> no payouts to show
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
            buildPayouts(txs, mode, addr, userAddrs),
          ),
        ),
      );
      return sortPayoutsByDateDesc(perWallet.flat());
    },
    enabled: !!session && !!profile,
    refetchInterval: PAYOUTS_POLL_MS,
    staleTime: PAYOUTS_POLL_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
