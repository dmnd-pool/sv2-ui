import { z } from 'zod';
import { MAX_PASSWORD_BYTES, MIN_PASSWORD_LENGTH, PASSWORD_TOO_LONG_MESSAGE, passwordByteLength, scoreStrength } from './passwordStrength';

const email = z.string().trim().min(1, 'Enter your email').pipe(z.email('Enter a valid email'));

export const signInSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password'),
});
export type SignInValues = z.infer<typeof signInSchema>;

// The miner sign-in adds "Remember me". The broker screen does not, so
// the two forms stay independent.
export const minerSignInSchema = signInSchema.extend({
  remember: z.boolean(),
});
export type MinerSignInValues = z.infer<typeof minerSignInSchema>;

// Watcher sign-in: the two halves of a Watcher link, typed or pasted.
// The token is the password.
export const watcherSignInSchema = z.object({
  userId: z.string().trim().min(1, 'Enter the account ID from your Watcher link'),
  token: z.string().trim().min(1, 'Enter your Watcher token'),
});
export type WatcherSignInValues = z.infer<typeof watcherSignInSchema>;

export const emailSchema = z.object({ email });
export type EmailValues = z.infer<typeof emailSchema>;

export const signUpDetailsSchema = z.object({
  firstName: z.string().trim().min(1, 'Enter your first name'),
  lastName: z.string().trim().min(1, 'Enter your last name'),
  email,
  companyName: z.string().trim().optional(),
  companyLocation: z.string().trim().optional(),
});
export type SignUpDetailsValues = z.infer<typeof signUpDetailsSchema>;

const newPassword = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Password should be a minimum of ${MIN_PASSWORD_LENGTH} characters`);
const minerPassword = (accountEmail: string) => z.string().superRefine(async (password, ctx) => {
  if (passwordByteLength(password) > MAX_PASSWORD_BYTES) {
    ctx.addIssue({ code: 'custom', message: PASSWORD_TOO_LONG_MESSAGE });
  } else if (password.length === 0) {
    ctx.addIssue({ code: 'custom', message: 'Password cannot be empty' });
  } else if ((await scoreStrength(password, accountEmail)).level !== 'strong') {
    ctx.addIssue({
      code: 'custom',
      message: 'Password is too weak. Use a mix of uppercase, lowercase, numbers, and special characters.',
    });
  }
});
const confirmPassword = z.string().min(1, 'Re-enter your password');
const passwordsMatch = (v: { password: string; confirmPassword: string }) =>
  v.password === v.confirmPassword;
const matchError = { message: 'Passwords do not match', path: ['confirmPassword'] };

export const createSignUpPasswordSchema = (accountEmail: string) => z
  .object({ password: minerPassword(accountEmail), confirmPassword, referralCode: z.string().trim().optional() })
  .refine(passwordsMatch, matchError);
export type SignUpPasswordValues = z.infer<ReturnType<typeof createSignUpPasswordSchema>>;

export const createResetPasswordSchema = (accountEmail: string) => z
  .object({ password: minerPassword(accountEmail), confirmPassword })
  .refine(passwordsMatch, matchError);
export type ResetPasswordValues = z.infer<ReturnType<typeof createResetPasswordSchema>>;

// The reset token the user copies from the recovery email and types on the
// "We sent you a code" step.
export const resetTokenSchema = z.object({
  token: z.string().trim().min(1, 'Enter the reset token from your email'),
});
export type ResetTokenValues = z.infer<typeof resetTokenSchema>;

export const brokerSignUpDetailsSchema = z.object({
  firstName: z.string().trim().min(1, 'Enter your first name'),
  lastName: z.string().trim().min(1, 'Enter your last name'),
  email,
  companyName: z.string().trim().min(1, 'Enter your company name'),
  companyLocation: z.string().trim().min(1, 'Enter your company location'),
});
export type BrokerSignUpDetailsValues = z.infer<typeof brokerSignUpDetailsSchema>;

export const brokerPasswordSchema = z
  .object({ password: newPassword, confirmPassword })
  .refine(passwordsMatch, matchError);
export type BrokerPasswordValues = z.infer<typeof brokerPasswordSchema>;
