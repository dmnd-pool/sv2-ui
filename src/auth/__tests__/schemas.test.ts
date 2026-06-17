import assert from 'node:assert/strict';
import test from 'node:test';

import {
  emailSchema,
  resetPasswordSchema,
  resetTokenSchema,
  signInSchema,
  signUpDetailsSchema,
  signUpPasswordSchema,
} from '../schemas';

function firstError(result: {
  success: boolean;
  error?: { issues: ReadonlyArray<{ message: string; path: PropertyKey[] }> };
}) {
  return result.success ? null : result.error!.issues[0];
}

test('signInSchema reports empty email and password distinctly', () => {
  assert.equal(firstError(signInSchema.safeParse({ email: '', password: 'x' }))?.message, 'Enter your email');
  assert.equal(
    firstError(signInSchema.safeParse({ email: 'm@x.io', password: '' }))?.message,
    'Enter your password',
  );
});

test('resetPasswordSchema enforces the 9-char minimum and matching confirmation', () => {
  assert.equal(
    firstError(resetPasswordSchema.safeParse({ password: 'short', confirmPassword: 'short' }))?.message,
    'Password should be a minimum of 9 characters',
  );
  const mismatch = firstError(
    resetPasswordSchema.safeParse({ password: 'longenough', confirmPassword: 'different' }),
  );
  assert.equal(mismatch?.message, 'Passwords do not match');
  assert.deepEqual(mismatch?.path, ['confirmPassword']);
  assert.equal(
    resetPasswordSchema.safeParse({ password: 'longenough', confirmPassword: 'longenough' }).success,
    true,
  );
});

test('signInSchema rejects a malformed email and trims a valid one', () => {
  assert.equal(firstError(signInSchema.safeParse({ email: 'nope', password: 'x' }))?.message, 'Enter a valid email');
  const ok = signInSchema.safeParse({ email: '  m@x.io  ', password: 'pw' });
  assert.equal(ok.success, true);
  assert.equal(ok.success && ok.data.email, 'm@x.io');
});

test('signUpPasswordSchema enforces length and matching confirmation', () => {
  assert.equal(
    firstError(signUpPasswordSchema.safeParse({ password: 'short', confirmPassword: 'short' }))?.message,
    'Password should be a minimum of 9 characters',
  );

  const mismatch = firstError(
    signUpPasswordSchema.safeParse({ password: 'longenough', confirmPassword: 'different' }),
  );
  assert.equal(mismatch?.message, 'Passwords do not match');
  assert.deepEqual(mismatch?.path, ['confirmPassword']);
});

test('signUpPasswordSchema accepts a matching password and optional referral', () => {
  assert.equal(
    signUpPasswordSchema.safeParse({ password: 'longenough', confirmPassword: 'longenough' }).success,
    true,
  );
  assert.equal(
    signUpPasswordSchema.safeParse({
      password: 'longenough',
      confirmPassword: 'longenough',
      referralCode: 'FRIEND',
    }).success,
    true,
  );
});

test('signUpDetailsSchema requires names and email, allows optional company fields', () => {
  assert.equal(
    firstError(signUpDetailsSchema.safeParse({ firstName: '', lastName: 'L', email: 'm@x.io' }))?.message,
    'Enter your first name',
  );
  assert.equal(signUpDetailsSchema.safeParse({ firstName: 'Ada', lastName: 'Lovelace', email: 'm@x.io' }).success, true);
  assert.equal(
    signUpDetailsSchema.safeParse({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'm@x.io',
      companyName: 'Demand',
      companyLocation: 'Lisbon, PT',
    }).success,
    true,
  );
});

test('emailSchema validates the forgot-password field', () => {
  assert.equal(emailSchema.safeParse({ email: 'm@x.io' }).success, true);
  assert.equal(firstError(emailSchema.safeParse({ email: 'bad' }))?.message, 'Enter a valid email');
});

test('resetTokenSchema requires a non-empty token and trims it', () => {
  assert.equal(
    firstError(resetTokenSchema.safeParse({ token: '   ' }))?.message,
    'Enter the reset token from your email',
  );
  const ok = resetTokenSchema.safeParse({ token: '  W9qbD2xh  ' });
  assert.equal(ok.success, true);
  assert.equal(ok.success && ok.data.token, 'W9qbD2xh');
});
