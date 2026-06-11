import { DmndApiError } from '@/dmnd';

/**
 * Turns a failed DMND call into a short, user-facing line. The unauthorized
 * copy differs by screen (a bad login versus an unexpected 401 elsewhere), so
 * the caller passes the wording that fits.
 */
export function authErrorMessage(error: unknown, unauthorized = 'Not authorized.'): string {
  if (error instanceof DmndApiError) {
    if (error.code === 'unauthorized') return unauthorized;
    if (error.code === 'network') {
      return "Can't reach DMND right now. Check your connection and try again.";
    }
    if (error.code === 'server') return 'DMND is having trouble. Please try again in a moment.';
    // 'unknown' carries the server's own message (e.g. a password-strength hint).
    if (error.code === 'unknown' && error.message) return error.message;
  }
  return 'Something went wrong. Please try again.';
}
