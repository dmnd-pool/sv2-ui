export type PasswordStrengthLevel = 'empty' | 'weak' | 'medium' | 'strong';

export interface PasswordStrength {
  level: PasswordStrengthLevel;
  /** Helper text shown under the field. */
  message: string;
}

export const MIN_PASSWORD_LENGTH = 9;

const MESSAGES: Record<PasswordStrengthLevel, string> = {
  empty: `Password should be a minimum of ${MIN_PASSWORD_LENGTH} characters`,
  weak: 'Password is weak, add letters, numbers, and symbols.',
  medium: 'Add a few more characters to strengthen your password',
  strong: 'Password looks good',
};

/**
 * zxcvbn score at/above which the password reads "strong" (green). Calibrated
 * against the live DMND API: it rejects score 2 (e.g. "Sato@123456") and accepts
 * score 3+, so green here means the server will actually take the password.
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
 * Instant, dependency-free read shown before the zxcvbn engine has loaded. It
 * never claims 'strong' (only zxcvbn can), so the bar can't flash a false green.
 */
export function quickStrength(password: string): PasswordStrength {
  if (password.length === 0) return build('empty');
  if (password.length < MIN_PASSWORD_LENGTH) return build('weak');
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((re) => re.test(password)).length;
  return build(classes >= 3 ? 'medium' : 'weak');
}

// zxcvbn ships large dictionaries, so it's imported on demand and configured
// once (common + English packs), then cached for every later check.
let enginePromise: Promise<(pw: string) => number> | null = null;
function loadEngine(): Promise<(pw: string) => number> {
  if (!enginePromise) {
    enginePromise = (async () => {
      const [core, common, en] = await Promise.all([
        import('@zxcvbn-ts/core'),
        import('@zxcvbn-ts/language-common'),
        import('@zxcvbn-ts/language-en'),
      ]);
      core.zxcvbnOptions.setOptions({
        dictionary: { ...common.dictionary, ...en.dictionary },
        graphs: common.adjacencyGraphs,
        translations: en.translations,
      });
      return (pw: string) => core.zxcvbn(pw).score;
    })();
  }
  return enginePromise;
}

/** Warm the zxcvbn chunk ahead of time (e.g. on password-field focus). */
export function preloadPasswordStrength(): void {
  void loadEngine();
}

/**
 * Full strength read: length rules first, then the zxcvbn score for the bar
 * level, matching the entropy check the server enforces on submit.
 */
export async function scoreStrength(password: string): Promise<PasswordStrength> {
  if (password.length === 0) return build('empty');
  if (password.length < MIN_PASSWORD_LENGTH) return build('weak');
  const score = await loadEngine();
  return build(levelFromScore(score(password)));
}
