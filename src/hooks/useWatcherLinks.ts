import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getDmndClient } from '@/api';
import { useAuth } from '@/auth';
import type { CreateWatcherLinkInput } from '@/api/types';

// Watcher links change only when the user creates or revokes one, so they are not
// polled; the mutations invalidate the list instead.
const WATCHER_STALE_MS = 60 * 1000;

/** The account's watcher links (GET /api/api-tokens), newest-first ordering left to the page. */
export function useWatcherLinks() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['account', 'watcher-links'],
    queryFn: ({ signal }) => getDmndClient().getWatcherLinks({ signal }),
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
    mutationFn: (input: CreateWatcherLinkInput) => getDmndClient().createWatcherLink(input),
    retry: false,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['account', 'watcher-links'] }),
  });
}

/** Revoke a watcher link, then refresh the list so the row disappears. */
export function useRevokeWatcherLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => getDmndClient().revokeWatcherLink(id),
    retry: false,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['account', 'watcher-links'] }),
  });
}
