import { useQuery } from '@tanstack/react-query';
import { getUser } from '@/api';
import { useActiveAccountId } from './useActiveAccountId';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export function usePplnsProjection() {
  const accountId = useActiveAccountId();
  return useQuery({
    queryKey: ['account', 'pplns-projection', accountId],
    queryFn: ({ signal }) => {
      if (!accountId) throw new Error('No account');
      return getUser().getPplnsProjection(accountId, { signal });
    },
    enabled: !!accountId,
    staleTime: REFRESH_INTERVAL_MS,
    refetchInterval: REFRESH_INTERVAL_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
