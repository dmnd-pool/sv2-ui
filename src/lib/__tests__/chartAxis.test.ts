import test from 'node:test';
import assert from 'node:assert/strict';
import { pickHashrateScale, formatAxisValue, xAxisTickLabel, yAxisTicks, tooltipTimestamp } from '../chartAxis';

test('tooltipTimestamp reads "Today" only for a sample from the current UTC day', () => {
  const now = Date.parse('2026-07-29T10:00:00.000Z');
  assert.equal(tooltipTimestamp('2026-07-29T06:32:00.000Z', now), 'Today  ·  06:32 UTC');
  const older = tooltipTimestamp('2026-07-01T06:32:00.000Z', now);
  assert.ok(!older.includes('Today'), 'a past day must not read as Today');
  assert.match(older, /Jul 1\s+·\s+06:32 UTC/);
});

test('tooltipTimestamp passes through an unparseable value', () => {
  assert.equal(tooltipTimestamp('nope', Date.now()), 'nope');
});

test('yAxisTicks gives four evenly spaced ticks and no zero, like the design', () => {
  // The design's axis reads 40 / 80 / 120 / 160 for a series peaking around 152.
  const { domainMax, ticks } = yAxisTicks(152.4e12);
  assert.equal(domainMax, 160e12);
  assert.deepEqual(ticks, [40e12, 80e12, 120e12, 160e12]);
  assert.ok(!ticks.includes(0), 'zero must not be a labelled tick');
});

test('yAxisTicks degrades safely with no usable maximum', () => {
  assert.deepEqual(yAxisTicks(0).ticks, []);
  assert.deepEqual(yAxisTicks(Number.NaN).ticks, []);
});

test('pickHashrateScale falls back to H/s when there is no data', () => {
  assert.deepEqual(pickHashrateScale([]), { unit: 'H/s', divisor: 1 });
  assert.deepEqual(pickHashrateScale([0, 0]), { unit: 'H/s', divisor: 1 });
});

test('pickHashrateScale ignores nulls and picks the unit from the largest value', () => {
  assert.deepEqual(pickHashrateScale([null, 1500, null]), { unit: 'KH/s', divisor: 1e3 });
  assert.deepEqual(pickHashrateScale([8_947_848, null]), { unit: 'MH/s', divisor: 1e6 });
  assert.deepEqual(pickHashrateScale([89.2e12, 1e6]), { unit: 'TH/s', divisor: 1e12 });
});

test('pickHashrateScale caps at EH/s rather than inventing a bigger unit', () => {
  assert.deepEqual(pickHashrateScale([1e24]), { unit: 'EH/s', divisor: 1e18 });
});

test('formatAxisValue renders a bare number in the axis unit, no unit suffix', () => {
  // The design prints the unit ONCE above the axis, so ticks are bare numbers.
  assert.equal(formatAxisValue(160e12, 1e12), '160');
  assert.equal(formatAxisValue(40e12, 1e12), '40');
  assert.equal(formatAxisValue(8.95e6, 1e6), '8.9');
  assert.equal(formatAxisValue(8.96e6, 1e6), '9');
  assert.equal(formatAxisValue(0, 1e6), '0');
});

test('formatAxisValue keeps one decimal only when it changes the reading', () => {
  assert.equal(formatAxisValue(1.5e6, 1e6), '1.5');
  assert.equal(formatAxisValue(2e6, 1e6), '2');
});

test('xAxisTickLabel labels the final tick "Now" when the window ends at the present', () => {
  const t = '2026-07-29T00:00:00.000Z';
  assert.equal(xAxisTickLabel(t, 4, 4, { isCustom: false, endsNow: true }), 'Now');
  assert.notEqual(xAxisTickLabel(t, 0, 4, { isCustom: false, endsNow: true }), 'Now');
});

test('xAxisTickLabel never says "Now" for a historical window', () => {
  // A custom range that ended in the past must not claim its last sample is "Now".
  const t = '2026-07-01T00:00:00.000Z';
  assert.notEqual(xAxisTickLabel(t, 4, 4, { isCustom: true, endsNow: false }), 'Now');
});

test('xAxisTickLabel renders dates for a multi-day custom span and times otherwise', () => {
  const t = '2026-07-29T06:32:00.000Z';
  const asCustom = xAxisTickLabel(t, 1, 4, { isCustom: true, endsNow: false });
  const asPreset = xAxisTickLabel(t, 1, 4, { isCustom: false, endsNow: true });
  assert.match(asCustom, /Jul/);
  assert.match(asPreset, /\d{2}:\d{2}/);
});

test('xAxisTickLabel passes through a value it cannot parse', () => {
  assert.equal(xAxisTickLabel('not-a-date', 1, 4, { isCustom: false, endsNow: true }), 'not-a-date');
});
