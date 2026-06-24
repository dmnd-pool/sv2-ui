/**
 * Builds the `otpauth://` URI an authenticator app reads from the QR code on the
 * Setup 2FA step. The secret is the account's base32 `two_factor_secret`; the
 * label and issuer are what shows up as the entry name in Google Authenticator
 * or Authy. Defaults match the server's TOTP (SHA1, 6 digits, 30s period).
 */
export function buildOtpAuthUri(secret: string, account: string, issuer = 'DMND'): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
