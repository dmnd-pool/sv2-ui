import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { getDmndClient } from '@/api';
import { useAuth } from '@/auth';
import { useAccountProfile } from './useAccountData';

// The subaccount list belongs to the master account, not to whichever account is
// currently being viewed -- `getSubaccounts()` returns an empty list once
// authenticated as a subaccount (verified live), so this entry must survive a switch
// or the account switcher and the aggregated-mode gating (useHasSubaccounts) would
// both read "no subaccounts" the moment a miner drills into one, with no way back
// except a reload.
const SUBACCOUNT_LIST_KEY = ['account', 'subaccounts', 'list'];

function isSubaccountListKey(key: QueryKey): boolean {
  return key.length === SUBACCOUNT_LIST_KEY.length && key.every((part, i) => part === SUBACCOUNT_LIST_KEY[i]);
}

/**
 * Switching which account the dashboard reads. Selecting a subaccount issues a
 * subaccount session first (the pool scopes reads by that cookie plus the account
 * header), then points the client at it; returning to the main account just drops the
 * override, since the master session was never replaced. Every OTHER cached query is
 * cleared on each switch so one account's figures can never render under another's
 * name; the subaccount list is the one exception (see SUBACCOUNT_LIST_KEY).
 */
export function useAccountSwitcher() {
  const { session, viewingAccountId, setViewingAccount } = useAuth();
  // The master account's own token, which the pool requires to issue a subaccount
  // session. It comes from the account profile, not the browser session (which only
  // tracks the account id and expiry).
  const { data: profile } = useAccountProfile();
  const queryClient = useQueryClient();
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Remember the master account's token while it is the one on screen. Switching
  // re-reads the profile as the subaccount, so without this the next switch would
  // send a subaccount's token where the pool expects the owner's.
  const ownerTokenRef = useRef<string | null>(null);
  useEffect(() => {
    if (viewingAccountId === null && profile?.token) {
      ownerTokenRef.current = profile.token;
    }
  }, [viewingAccountId, profile?.token]);

  const switchToSubaccount = useCallback(
    async (subaccount: { id: string; token: string }) => {
      // Ignore a second pick while one is in flight, so two rapid clicks cannot leave
      // the client pointed at one account while the cache holds another's data.
      if (!session || switching) return;
      const ownerToken = ownerTokenRef.current;
      if (!ownerToken) {
        setError("Couldn't open that subaccount");
        return;
      }
      setSwitching(true);
      setError(null);
      try {
        await getDmndClient().logSubaccount(ownerToken, subaccount.token);
        setViewingAccount(subaccount.id);
        queryClient.removeQueries({ predicate: (q) => !isSubaccountListKey(q.queryKey) });
      } catch {
        // Stay on the current account rather than showing an empty or mismatched
        // dashboard when the subaccount session could not be issued.
        setError("Couldn't open that subaccount");
      } finally {
        setSwitching(false);
      }
    },
    [session, switching, setViewingAccount, queryClient],
  );

  const switchToMain = useCallback(() => {
    setViewingAccount(null);
    queryClient.removeQueries({ predicate: (q) => !isSubaccountListKey(q.queryKey) });
  }, [setViewingAccount, queryClient]);

  return { viewingAccountId, switching, error, switchToSubaccount, switchToMain };
}
