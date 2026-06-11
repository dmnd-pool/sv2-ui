/**
 * Reads the `next` redirect target from a location search string and returns a
 * path that is safe to navigate to after login. Anything that could send the
 * user off-origin collapses to '/'.
 *
 * The dangerous cases are protocol-relative (`//evil.com`) and backslash
 * (`/\evil.com`) values, which browsers resolve cross-origin even though they
 * start with a slash. Decoding happens before the checks so an encoded `%2F`
 * cannot smuggle a second leading slash past them.
 */
export function readNextParam(search: string): string {
  const raw = new URLSearchParams(search).get('next');
  if (!raw) return '/';

  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return '/';
  }

  if (!decoded.startsWith('/')) return '/';
  if (decoded.startsWith('//')) return '/';
  if (decoded.startsWith('/\\')) return '/';

  return decoded;
}
