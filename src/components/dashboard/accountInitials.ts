/**
 * Two-letter avatar initials derived from an account email. Uses the part
 * before the @, splitting on common separators so "ada.lovelace@x.io" -> "AL"
 * and "satoshi@x.io" -> "SA". Falls back to "?" when there's nothing to use.
 */
export function accountInitials(email: string | undefined): string {
  const local = (email ?? '').split('@')[0] ?? '';
  const parts = local.split(/[.\-_]+/).filter(Boolean);
  const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : local.slice(0, 2);
  return (letters || '?').toUpperCase();
}
