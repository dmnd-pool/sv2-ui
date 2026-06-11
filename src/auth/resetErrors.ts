import { DmndApiError } from '@/dmnd';

/**
 * Whether a failed reset_password attempt means the account needs a 2FA code, so
 * the flow should show the "verify it's you" step and resubmit with the code.
 *
 * Reset is try-then-ask: submit with no 2FA code first, and only ask for one if
 * the backend says it's required. The exact prod signal is unconfirmed — staging
 * deliberately doesn't enforce 2FA, so we can't observe it there — so this
 * matches the known 2FA error shapes seen on other endpoints (the 404 "Invalid
 * 2FA token" and the 401 invalid-2fa-token). One-line change once confirmed.
 */
export function isTwoFactorRequiredError(error: unknown): boolean {
  if (!(error instanceof DmndApiError)) return false;
  return /2fa|two[- ]?factor|authenticator|invalid.?token/i.test(error.message);
}
