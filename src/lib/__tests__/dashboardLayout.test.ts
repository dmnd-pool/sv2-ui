import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_WIDGETS,
  WIDGET_IDS,
  normalizeLayout,
  toggleWidget,
  moveWidget,
  reorderWidget,
  visibleInOrder,
} from '@/lib/dashboardLayout';

test('the default layout shows every widget in the canonical order', () => {
  assert.deepEqual(
    DEFAULT_WIDGETS.map((w) => w.id),
    WIDGET_IDS,
  );
  assert.ok(DEFAULT_WIDGETS.every((w) => w.visible));
});

test('normalizeLayout repairs a stored layout: drops unknown ids, adds missing ones, keeps order', () => {
  // an old stored layout missing a newly-added widget + carrying a removed one
  // (a raw persisted value, so it can hold ids that are no longer valid)
  const stored = {
    order: ['performance', 'ghost-widget', 'hashrate'],
    hidden: ['performance'],
  };
  const layout = normalizeLayout(stored);
  // unknown id dropped, known ones kept in their stored order, missing appended
  assert.ok(!(layout.order as string[]).includes('ghost-widget'));
  assert.equal(layout.order[0], 'performance');
  assert.equal(layout.order[1], 'hashrate');
  // every real widget present exactly once
  assert.deepEqual([...layout.order].sort(), [...WIDGET_IDS].sort());
  // hidden set only keeps real ids
  assert.deepEqual(layout.hidden, ['performance']);
});

test('normalizeLayout of null/garbage returns the default (all visible, canonical order)', () => {
  const layout = normalizeLayout(null);
  assert.deepEqual(layout.order, WIDGET_IDS);
  assert.deepEqual(layout.hidden, []);
});

test('toggleWidget flips visibility without touching order', () => {
  const base = normalizeLayout(null);
  const hidden = toggleWidget(base, 'hashrate');
  assert.ok(hidden.hidden.includes('hashrate'));
  assert.deepEqual(hidden.order, base.order);
  const shownAgain = toggleWidget(hidden, 'hashrate');
  assert.ok(!shownAgain.hidden.includes('hashrate'));
});

test('reorderWidget moves a widget to a target index, shifting the rest', () => {
  const base = normalizeLayout(null); // [hashrate, connect, stats, performance]
  // drag the last (performance) to the front
  const toFront = reorderWidget(base, 'performance', 0);
  assert.equal(toFront.order[0], 'performance');
  assert.deepEqual([...toFront.order].sort(), [...WIDGET_IDS].sort());
  // drag the first to index 2
  const moved = reorderWidget(base, base.order[0], 2);
  assert.equal(moved.order[2], base.order[0]);
  // dropping onto itself is a no-op; an out-of-range target clamps
  assert.deepEqual(reorderWidget(base, 'stats', base.order.indexOf('stats')).order, base.order);
  assert.equal(reorderWidget(base, 'hashrate', 999).order.at(-1), 'hashrate');
  // an unknown id is ignored
  assert.deepEqual(reorderWidget(base, 'ghost' as never, 0).order, base.order);
});

test('moveWidget reorders up and down and is a no-op at the edges', () => {
  const base = normalizeLayout(null);
  const first = base.order[0];
  const second = base.order[1];
  const down = moveWidget(base, first, 'down');
  assert.equal(down.order[0], second);
  assert.equal(down.order[1], first);
  // moving the first widget up does nothing
  assert.deepEqual(moveWidget(base, first, 'up').order, base.order);
  // moving the last widget down does nothing
  const last = base.order[base.order.length - 1];
  assert.deepEqual(moveWidget(base, last, 'down').order, base.order);
});

test('visibleInOrder returns only shown widgets, in the layout order', () => {
  let layout = normalizeLayout(null);
  layout = toggleWidget(layout, layout.order[0]); // hide the first
  const shown = visibleInOrder(layout);
  assert.ok(!shown.some((w) => w.id === layout.order[0]));
  assert.deepEqual(
    shown.map((w) => w.id),
    layout.order.slice(1),
  );
});
