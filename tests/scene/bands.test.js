import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  circularDistance,
  nearestBand,
  parseBands,
  rowHoopIndices,
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

test('rowHoopIndices maps each row to its hoop, skipping invalid rows', () => {
  // Hoop indices count only valid rows, in order, matching parseBands.
  assert.deepEqual(rowHoopIndices(['0.05', 'abc', '0.22', '', '0.38']), [0, -1, 1, -1, 2]);
  assert.deepEqual(rowHoopIndices([]), []);
});
