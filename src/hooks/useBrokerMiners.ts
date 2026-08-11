import { useQuery } from '@tanstack/react-query';
import { getUser } from '@/api';
import type { BrokerMiner } from '@/api/types';

/**
 * The server requires a starting block height and rejects the request without one.
 * 0 asks for the whole history, which is what the dashboard shows: the design has no
 * range control, so narrowing the window here would hide miners with no explanation.
 */
export const BROKER_MINERS_FROM_BLOCK_HEIGHT = 0;

/**
 * The miners assigned to the signed-in broker's referral code.
 *
 * Cookie-authenticated like every other broker call, so it carries no miner account
 * header. `retry: false` keeps a failed load from hammering an endpoint that returns
 * a 500 when its required parameter is missing.
 */
export function useBrokerMiners() {
  return useQuery<BrokerMiner[]>({
    queryKey: ['broker', 'miners', BROKER_MINERS_FROM_BLOCK_HEIGHT],
    queryFn: ({ signal }) => getUser().brokerMiners(BROKER_MINERS_FROM_BLOCK_HEIGHT, { signal }),
    retry: false,
  });
}
