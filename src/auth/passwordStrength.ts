import { zxcvbnAsync, zxcvbnOptions } from '@zxcvbn-ts/core';
import { adjacencyGraphs, dictionary as commonDictionary } from '@zxcvbn-ts/language-common';
import { dictionary as englishDictionary, translations } from '@zxcvbn-ts/language-en';

zxcvbnOptions.setOptions({
  dictionary: { ...commonDictionary, ...englishDictionary },
  graphs: adjacencyGraphs,
  translations,
});

export type PasswordStrengthLevel = 'empty' | 'weak' | 'medium' | 'strong';

export interface PasswordStrength {
  level: PasswordStrengthLevel;
  /** Helper text shown under the field. */
  message: string;
}

export const MIN_PASSWORD_LENGTH = 9;
export const MAX_PASSWORD_BYTES = 4096;
export const PASSWORD_TOO_LONG_MESSAGE = 'Password is too long.';

export function passwordByteLength(password: string): number {
  return new TextEncoder().encode(password).length;
}

const MESSAGES: Record<PasswordStrengthLevel, string> = {
  empty: 'Enter a strong password',
  weak: 'Password is weak, add letters, numbers, and symbols.',
  medium: 'Add a few more characters to strengthen your password',
  strong: 'Password looks good',
};

/**
 * Miner signup, password reset, and the meter use a zxcvbn score of at least 3 for
 * "strong". The server independently validates on submit.
 */
const STRONG_SCORE = 3;

export function levelFromScore(score: number): PasswordStrengthLevel {
  if (score >= STRONG_SCORE) return 'strong';
  if (score === 2) return 'medium';
  return 'weak';
}

function build(level: PasswordStrengthLevel): PasswordStrength {
  return { level, message: MESSAGES[level] };
}

/**
 * Instant read shown before the debounced zxcvbn score. It
 * never claims 'strong' (only zxcvbn can), so the bar can't flash a false green.
 */
export function quickStrength(password: string): PasswordStrength {
  if (password.length === 0) return build('empty');
  if (passwordByteLength(password) > MAX_PASSWORD_BYTES) return { level: 'weak', message: PASSWORD_TOO_LONG_MESSAGE };
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((re) => re.test(password)).length;
  return build(classes >= 3 ? 'medium' : 'weak');
}

/**
 * Full strength read: length rules first, then zxcvbn with the account email
 * as a user input, as in the backend miner password check. The browser and
 * server implementations can score differently, so server validation is final.
 */
export async function scoreStrength(password: string, email = ''): Promise<PasswordStrength> {
  if (password.length === 0) return build('empty');
  if (passwordByteLength(password) > MAX_PASSWORD_BYTES) return { level: 'weak', message: PASSWORD_TOO_LONG_MESSAGE };
  const { score } = await zxcvbnAsync(password, email ? [email] : []);
  return build(levelFromScore(score));
}
