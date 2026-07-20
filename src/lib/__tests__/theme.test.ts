import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveIsDark, normalizeThemePreference, type ThemePreference } from '@/lib/theme';

test('resolveIsDark: explicit light/dark ignore the system preference', () => {
  assert.equal(resolveIsDark('light', true), false);
  assert.equal(resolveIsDark('light', false), false);
  assert.equal(resolveIsDark('dark', true), true);
  assert.equal(resolveIsDark('dark', false), true);
});

test('resolveIsDark: system follows the OS preference', () => {
  assert.equal(resolveIsDark('system', true), true);
  assert.equal(resolveIsDark('system', false), false);
});

test('normalizeThemePreference reads a stored value, defaulting to light', () => {
  assert.equal(normalizeThemePreference('dark'), 'dark');
  assert.equal(normalizeThemePreference('light'), 'light');
  assert.equal(normalizeThemePreference('system'), 'system');
  // legacy/unknown/absent values fall back to light (the app's default)
  assert.equal(normalizeThemePreference(null), 'light');
  assert.equal(normalizeThemePreference(''), 'light');
  assert.equal(normalizeThemePreference('purple'), 'light');
});

test('the three preferences are exactly light, dark, system', () => {
  const all: ThemePreference[] = ['light', 'dark', 'system'];
  assert.equal(all.length, 3);
});
