import { z } from 'zod';
import { MIN_PASSWORD_LENGTH } from './passwordStrength';

const email = z.string().trim().min(1, 'Enter your email').pipe(z.email('Enter a valid email'));

export const signInSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password'),
});
export type SignInValues = z.infer<typeof signInSchema>;

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
const confirmPassword = z.string().min(1, 'Re-enter your password');
const passwordsMatch = (v: { password: string; confirmPassword: string }) =>
  v.password === v.confirmPassword;
const matchError = { message: 'Passwords do not match', path: ['confirmPassword'] };

export const signUpPasswordSchema = z
  .object({ password: newPassword, confirmPassword, referralCode: z.string().trim().optional() })
  .refine(passwordsMatch, matchError);
export type SignUpPasswordValues = z.infer<typeof signUpPasswordSchema>;

export const resetPasswordSchema = z
  .object({ password: newPassword, confirmPassword })
  .refine(passwordsMatch, matchError);
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

// The reset token the user copies from the recovery email and types on the
// "We sent you a code" step.
export const resetTokenSchema = z.object({
  token: z.string().trim().min(1, 'Enter the reset token from your email'),
});
export type ResetTokenValues = z.infer<typeof resetTokenSchema>;

// Broker signup: company name and location are REQUIRED (asterisks on the
// design), unlike the optional miner fields, and the API has no `| null` on
// them. No referral on the broker flow.
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
