import { DmndApiError } from '@/api';

/** The exact message the API returns when a reset needs the account's 2FA code. */
const TWO_FACTOR_REQUIRED_MESSAGE = 'Invalid 2FA token';

/**
 * Whether a failed reset_password attempt means the account needs a 2FA code, so
 * the flow should show the "verify it's you" step and resubmit with the code.
 *
 * Reset is try-then-ask: submit with no 2FA code first, and only ask for one if
 * the backend says it's required. The backend signals that with this exact
 * message, so we match it exactly rather than guessing with a pattern.
 */
export function isTwoFactorRequiredError(error: unknown): boolean {
  return error instanceof DmndApiError && error.message === TWO_FACTOR_REQUIRED_MESSAGE;
}
