import { DmndApiError } from '@/api';
import type { AuthState } from './authStore';

/** A 401, or the API's known invalid-cookie 400, proves the stored login is no longer valid. */
export function shouldEndSessionAfterValidation(error: unknown): boolean {
  return (
    error instanceof DmndApiError &&
    error.code === 'unauthorized' &&
    (error.status === 400 || error.status === 401)
  );
}

export type RejectedRequestAction = 'sign-out' | 'leave-subaccount' | 'ignore';

/**
 * A master-account rejection ends the login. A rejected selected subaccount
 * only drops that view because its cookie can expire independently while the
 * owner's session remains valid. Rejections from stale/anonymous requests do
 * not affect the current session.
 */
export function actionForRejectedRequest(
  state: Pick<AuthState, 'session' | 'viewingAccountId'>,
  rejectedAccountId: string | null,
): RejectedRequestAction {
  if (!state.session || !rejectedAccountId) return 'ignore';
  if (rejectedAccountId === state.session.accountId) return 'sign-out';
  if (rejectedAccountId === state.viewingAccountId) return 'leave-subaccount';
  return 'ignore';
}
