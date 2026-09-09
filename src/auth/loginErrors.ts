import { DmndApiError } from '@/api';

/** The exact 401 message /api/log_user returns when an enrolled account has no TOTP. */
const TWO_FACTOR_LOGIN_MESSAGE = 'Invalid credentials or two-factor token';

/** Whether password-only login should continue on the authenticator-code screen. */
export function isTwoFactorLoginRequiredError(error: unknown): boolean {
  return (
    error instanceof DmndApiError &&
    error.code === 'unauthorized' &&
    error.message === TWO_FACTOR_LOGIN_MESSAGE
  );
}
