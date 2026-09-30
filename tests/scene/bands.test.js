import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  circularDistance,
  focusEdges,
  nearestBand,
  parseBands,
} from '../../src/scene/bands.js';

const SIX = [0.05, 0.22, 0.38, 0.55, 0.72, 0.89];
const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

test('circularDistance wraps around 1', () => {
  assert.ok(close(circularDistance(0.95, 0.05), 0.1));
  assert.ok(close(circularDistance(0.05, 0.95), 0.1));
  assert.ok(close(circularDistance(0.3, 0.3), 0));
  assert.ok(close(circularDistance(0.0, 0.5), 0.5));
  assert.ok(close(circularDistance(1.05, 0.05), 0));
});

test('parseBands keeps valid values in order, wraps range, drops junk', () => {
  assert.deepEqual(parseBands(['0.05', '0.22']), [0.05, 0.22]);
  const out = parseBands(['1.05', '-0.25', '', 'abc', null, undefined, '0.5']);
  assert.equal(out.length, 3);
  assert.ok(close(out[0], 0.05, 1e-12));
  assert.ok(close(out[1], 0.75, 1e-12));
  assert.equal(out[2], 0.5);
});

test('nearestBand picks the circularly nearest, -1 when empty', () => {
  assert.equal(nearestBand(0.06, SIX), 0);
  assert.equal(nearestBand(0.99, SIX), 0); // wraps to 0.05
  assert.equal(nearestBand(0.3, SIX), 1); // 0.08 from 0.22, 0.08 from 0.38: first wins
  assert.equal(nearestBand(0.9, SIX), 5);
  assert.equal(nearestBand(0.5, []), -1);
});

test('focusEdges: half the smallest gap, inner at 82%', () => {
  const { inner, outer } = focusEdges(SIX); // smallest gap 0.16 (0.22->0.38, 0.89->0.05)
  assert.ok(close(outer, 0.08, 1e-9));
  assert.ok(close(inner, 0.0656, 1e-9));
});

test('focusEdges follows a seventh project', () => {
  const seven = Array.from({ length: 7 }, (_, i) => (i + 0.5) / 7);
  const { outer } = focusEdges(seven);
  assert.ok(close(outer, 1 / 14, 1e-9));
});

test('focusEdges never collapses on duplicate or bunched values', () => {
  assert.equal(focusEdges([0.3, 0.3, 0.6]).outer, 0.02);
  assert.equal(focusEdges([0.3, 0.301]).outer, 0.02);
});

test('focusEdges with one or no project lights everything', () => {
  assert.equal(focusEdges([0.4]).outer, 0.5);
  assert.equal(focusEdges([]).outer, 0.5);
});
