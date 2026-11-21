import assert from 'node:assert/strict';
import test from 'node:test';

import {
  brokerPasswordSchema,
  brokerSignUpDetailsSchema,
  emailSchema,
  createResetPasswordSchema,
  resetTokenSchema,
  minerSignInSchema,
  signInSchema,
  signUpDetailsSchema,
  createSignUpPasswordSchema,
  watcherSignInSchema,
} from '../schemas';

const signUpPasswordSchema = createSignUpPasswordSchema('m@x.io');
const resetPasswordSchema = createResetPasswordSchema('m@x.io');

function firstError(result: {
  success: boolean;
  error?: { issues: ReadonlyArray<{ message: string; path: PropertyKey[] }> };
}) {
  return result.success ? null : result.error!.issues[0];
}

test('miner signup rejects weak passwords before submission, like the old onboarding', async () => {
  for (const password of ['aaaaaaaaa', 'Sato@123456']) {
    const result = await signUpPasswordSchema.safeParseAsync({ password, confirmPassword: password });
    assert.equal(result.success, false, `${password} should fail the strength check`);
    assert.deepEqual(firstError(result)?.path, ['password']);
    assert.equal(
      firstError(result)?.message,
      'Password is too weak. Use a mix of uppercase, lowercase, numbers, and special characters.',
    );
  }
});

test('miner signup accepts a strong passphrase without requiring every character class', async () => {
  const password = 'correct horse battery staple';
  assert.equal((await signUpPasswordSchema.safeParseAsync({ password, confirmPassword: password })).success, true);
});

test('miner signup rejects a password based on the account email', async () => {
  const email = 'qvjrptax@example.com';
  const values = { password: email, confirmPassword: email };
  assert.equal((await signUpPasswordSchema.safeParseAsync(values)).success, true);
  const result = await createSignUpPasswordSchema(email).safeParseAsync(values);
  assert.equal(result.success, false);
  assert.deepEqual(firstError(result)?.path, ['password']);
});

test('miner password reset rejects empty passwords and passwords based on the account email', async () => {
  const email = 'qvjrptax@example.com';
  const schema = createResetPasswordSchema(email);
  for (const password of ['', email]) {
    const result = await schema.safeParseAsync({ password, confirmPassword: password || 'x' });
    assert.equal(result.success, false);
    assert.deepEqual(firstError(result)?.path, ['password']);
  }
});

test('signInSchema reports empty email and password distinctly', () => {
  assert.equal(firstError(signInSchema.safeParse({ email: '', password: 'x' }))?.message, 'Enter your email');
  assert.equal(
    firstError(signInSchema.safeParse({ email: 'm@x.io', password: '' }))?.message,
    'Enter your password',
  );
});

test('miner password reset validates strength and matching confirmation without a fixed minimum', async () => {
  assert.equal(
    firstError(await resetPasswordSchema.safeParseAsync({ password: 'short', confirmPassword: 'short' }))?.message,
    'Password is too weak. Use a mix of uppercase, lowercase, numbers, and special characters.',
  );
  assert.equal((await resetPasswordSchema.safeParseAsync({ password: 'aaaaaaaaa', confirmPassword: 'aaaaaaaaa' })).success, false);
  const password = 'correct horse battery staple';
  const mismatch = firstError(
    await resetPasswordSchema.safeParseAsync({ password, confirmPassword: 'different' }),
  );
  assert.equal(mismatch?.message, 'Passwords do not match');
  assert.deepEqual(mismatch?.path, ['confirmPassword']);
  assert.equal(
    (await resetPasswordSchema.safeParseAsync({ password, confirmPassword: password })).success,
    true,
  );
});

test('signInSchema rejects a malformed email and trims a valid one', () => {
  assert.equal(firstError(signInSchema.safeParse({ email: 'nope', password: 'x' }))?.message, 'Enter a valid email');
  const ok = signInSchema.safeParse({ email: '  m@x.io  ', password: 'pw' });
  assert.equal(ok.success, true);
  assert.equal(ok.success && ok.data.email, 'm@x.io');
});

test('miner signup requires a nonempty password and strength instead of a fixed minimum length', async () => {
  assert.equal(
    firstError(await signUpPasswordSchema.safeParseAsync({ password: '', confirmPassword: 'x' }))?.message,
    'Password cannot be empty',
  );
  assert.equal(
    firstError(await signUpPasswordSchema.safeParseAsync({ password: 'short', confirmPassword: 'short' }))?.message,
    'Password is too weak. Use a mix of uppercase, lowercase, numbers, and special characters.',
  );

  const mismatch = firstError(
    await signUpPasswordSchema.safeParseAsync({ password: 'correct horse battery staple', confirmPassword: 'different' }),
  );
  assert.equal(mismatch?.message, 'Passwords do not match');
  assert.deepEqual(mismatch?.path, ['confirmPassword']);
});

for (const [name, schema] of [['signup', signUpPasswordSchema], ['password reset', resetPasswordSchema]] as const) {
  test(`miner ${name} enforces an inclusive 4096-byte UTF-8 limit`, async () => {
    const prefix = 'vR7!qZ2@A9!rT6#k';
    for (const character of ['x', 'é', '😀']) {
      const bytes = new TextEncoder().encode(character).length;
      const password = prefix + character.repeat((4096 - prefix.length) / bytes);
      assert.equal(new TextEncoder().encode(password).length, 4096);
      assert.equal((await schema.safeParseAsync({ password, confirmPassword: password })).success, true);
      const tooLong = password + 'x';
      const result = await schema.safeParseAsync({ password: tooLong, confirmPassword: tooLong });
      assert.equal(firstError(result)?.message, 'Password is too long.');
      assert.deepEqual(firstError(result)?.path, ['password']);
    }
  });
}

test('signUpPasswordSchema accepts a matching password and optional referral', async () => {
  const password = 'correct horse battery staple';
  assert.equal(
    (await signUpPasswordSchema.safeParseAsync({ password, confirmPassword: password })).success,
    true,
  );
  assert.equal(
    (await signUpPasswordSchema.safeParseAsync({
      password,
      confirmPassword: password,
      referralCode: 'FRIEND',
    })).success,
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

test('brokerSignUpDetailsSchema requires company name and location', () => {
  assert.equal(
    brokerSignUpDetailsSchema.safeParse({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'b@x.io',
      companyName: 'Demand',
      companyLocation: 'Lisbon, PT',
    }).success,
    true,
  );
  assert.equal(
    firstError(
      brokerSignUpDetailsSchema.safeParse({
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'b@x.io',
        companyName: '',
        companyLocation: 'Lisbon, PT',
      }),
    )?.message,
    'Enter your company name',
  );
  assert.equal(
    firstError(
      brokerSignUpDetailsSchema.safeParse({
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'b@x.io',
        companyName: 'Demand',
        companyLocation: '',
      }),
    )?.message,
    'Enter your company location',
  );
});

test('brokerPasswordSchema enforces length and matching, with no referral field', async () => {
  // Broker registration has no backend entropy check; retain the existing FE minimum.
  const password = 'aaaaaaaaa';
  assert.equal(
    firstError(await brokerPasswordSchema.safeParseAsync({ password: 'short', confirmPassword: 'short' }))?.message,
    'Password should be a minimum of 9 characters',
  );
  const mismatch = firstError(
    await brokerPasswordSchema.safeParseAsync({ password, confirmPassword: 'different' }),
  );
  assert.equal(mismatch?.message, 'Passwords do not match');
  assert.equal(
    (await brokerPasswordSchema.safeParseAsync({ password, confirmPassword: password })).success,
    true,
  );
});

test('minerSignInSchema is the sign-in schema plus the Remember me flag', () => {
  assert.equal(minerSignInSchema.safeParse({ email: 'm@x.io', password: 'pw', remember: true }).success, true);
  assert.equal(minerSignInSchema.safeParse({ email: 'm@x.io', password: 'pw', remember: false }).success, true);
  // The flag is required, so the form can never submit an undefined "remember".
  assert.equal(minerSignInSchema.safeParse({ email: 'm@x.io', password: 'pw' }).success, false);
  // The email and password rules still apply unchanged.
  assert.equal(
    firstError(minerSignInSchema.safeParse({ email: 'nope', password: 'pw', remember: false }))?.message,
    'Enter a valid email',
  );
});

test('watcherSignInSchema needs both halves of the link, and trims what it keeps', () => {
  const ok = watcherSignInSchema.safeParse({ userId: '  -739  ', token: '  ABC123  ' });
  assert.equal(ok.success, true);
  assert.deepEqual(ok.data, { userId: '-739', token: 'ABC123' });

  assert.equal(
    firstError(watcherSignInSchema.safeParse({ userId: '   ', token: 'ABC123' }))?.message,
    'Enter the account ID from your Watcher link',
  );
  assert.equal(
    firstError(watcherSignInSchema.safeParse({ userId: '-739', token: '   ' }))?.message,
    'Enter your Watcher token',
  );
});
