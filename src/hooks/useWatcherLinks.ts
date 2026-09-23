import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getUser } from '@/api';
import { useAuth } from '@/auth';
import type { CreateWatcherLinkInput } from '@/api/types';
import { useActiveAccountId } from './useActiveAccountId';

// Watcher links change only when the user creates or revokes one, so they are not
// polled; the mutations invalidate the list instead.
const WATCHER_STALE_MS = 60 * 1000;

/** The account's watcher links (GET /api/api-tokens), newest-first ordering left to the page. */
export function useWatcherLinks() {
  const { session } = useAuth();
  const accountId = useActiveAccountId();
  return useQuery({
    queryKey: ['account', 'watcher-links', accountId],
    queryFn: ({ signal }) => getUser().getWatcherLinks({ signal, accountId: accountId ?? undefined }),
    enabled: !!session,
    staleTime: WATCHER_STALE_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/**
 * Issue a watcher link. The created link (with its full token) is returned to the
 * caller so the success panel can show it once; the list is refreshed so the new row
 * appears. Not retried: a retry could mint a second link.
 */
export function useCreateWatcherLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWatcherLinkInput & { totpToken?: string }) =>
      getUser().createWatcherLink(input, { totpToken: input.totpToken }),
    retry: false,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['account', 'watcher-links'] }),
  });
}

/** Revoke a watcher link, then refresh the list so the row disappears. */
export function useRevokeWatcherLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, totpToken }: { id: string; totpToken?: string }) =>
      getUser().revokeWatcherLink(id, { totpToken }),
    retry: false,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['account', 'watcher-links'] }),
  });
}
