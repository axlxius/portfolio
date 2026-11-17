import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  BANDS,
  COLUMN,
  ROLES,
  STATE_COUNT,
  VASE,
  bandOf,
  buildMeta,
  buildSegmentIndices,
  buildStates,
  curve,
  roleOf,
  vaseRadius,
} from '../../src/scene/shapes.ts';

const STRANDS = 240;
const LEN = 20;
const states = buildStates(STRANDS, LEN);
const [, vase, column, , , line] = states;

const point = (arr: Float32Array, s: number, l: number) => {
  const i = (s * LEN + l) * 3;
  return [arr[i], arr[i + 1], arr[i + 2]] as const;
};

test('one target array per state, all the right size and finite', () => {
  assert.equal(states.length, STATE_COUNT);
  for (const arr of states) {
    assert.equal(arr.length, STRANDS * LEN * 3);
    assert.ok(arr.every(Number.isFinite));
  }
});

test('the composition is deterministic', () => {
  const again = buildStates(STRANDS, LEN);
  states.forEach((arr, i) => assert.deepEqual(arr, again[i]));
});

test('every shape stays within the frame the camera expects', () => {
  for (const arr of states) {
    for (let i = 0; i < arr.length; i += 3) {
      assert.ok(Math.hypot(arr[i], arr[i + 1], arr[i + 2]) < 7, 'a point strayed too far from the origin');
    }
  }
});

test('vase: bands run top to bottom in list order and never overlap', () => {
  const ranges = Array.from({ length: BANDS }, () => ({ min: Infinity, max: -Infinity }));
  for (let s = 0; s < STRANDS; s++) {
    const [, y] = point(vase, s, 0);
    const r = ranges[bandOf(s)];
    r.min = Math.min(r.min, y);
    r.max = Math.max(r.max, y);
  }
  for (let b = 1; b < BANDS; b++) {
    assert.ok(ranges[b].max < ranges[b - 1].min, `band ${b} overlaps band ${b - 1}`);
  }
  assert.ok(ranges[0].max <= VASE.height / 2 + 0.05);
  assert.ok(ranges[BANDS - 1].min >= -VASE.height / 2 - 0.05);
});

test('vase: every strand is a level arc on the silhouette', () => {
  for (let s = 0; s < STRANDS; s++) {
    const [x, y, z] = point(vase, s, 0);
    const [x2, y2, z2] = point(vase, s, LEN - 1);
    assert.ok(Math.abs(y - y2) < 1e-6, 'a ring is not level');
    const expected = vaseRadius((y + VASE.height / 2) / VASE.height);
    assert.ok(Math.abs(Math.hypot(x, z) - expected) < 0.08);
    assert.ok(Math.abs(Math.hypot(x2, z2) - expected) < 0.08);
  }
});

test('column: roles run top to bottom and the newest sits highest', () => {
  const mean = new Array(ROLES).fill(0);
  const count = new Array(ROLES).fill(0);
  for (let s = 0; s < STRANDS; s++) {
    mean[roleOf(s)] += point(column, s, 0)[1];
    count[roleOf(s)]++;
  }
  const centres = mean.map((m, i) => m / count[i]);
  for (let r = 1; r < ROLES; r++) assert.ok(centres[r] < centres[r - 1]);
  assert.ok(centres[0] < COLUMN.height / 2);
});

test('work to experience is a vertical stretch: angles are shared', () => {
  for (let s = 0; s < STRANDS; s++) {
    for (const l of [0, LEN >> 1, LEN - 1]) {
      const [vx, , vz] = point(vase, s, l);
      const [cx, , cz] = point(column, s, l);
      const delta = Math.atan2(vz, vx) - Math.atan2(cz, cx);
      assert.ok(Math.abs(Math.atan2(Math.sin(delta), Math.cos(delta))) < 1e-4, 'a point changes angle between states');
    }
  }
});

test('the closing state is a single vertical line', () => {
  for (let i = 0; i < line.length; i += 3) {
    assert.equal(line[i], 0);
    assert.equal(line[i + 2], 0);
  }
});

test('any prefix of the strands is a fair sample of the bands and roles', () => {
  // This is what lets the renderer lower quality by drawing fewer strands.
  const prefix = Math.floor(STRANDS * 0.3);
  const bands = new Array(BANDS).fill(0);
  const roles = new Array(ROLES).fill(0);
  for (let s = 0; s < prefix; s++) {
    bands[bandOf(s)]++;
    roles[roleOf(s)]++;
  }
  assert.ok(Math.max(...bands) - Math.min(...bands) <= 1);
  assert.ok(Math.max(...roles) - Math.min(...roles) <= 1);
});

test('meta: seed is constant along a strand, position runs 0 to 1', () => {
  const meta = buildMeta(STRANDS, LEN);
  for (let s = 0; s < STRANDS; s++) {
    const base = s * LEN * 4;
    for (let l = 0; l < LEN; l++) {
      assert.equal(meta[base + l * 4], meta[base]);
      assert.equal(meta[base + l * 4 + 2], bandOf(s));
      assert.equal(meta[base + l * 4 + 3], roleOf(s));
    }
    assert.equal(meta[base + 1], 0);
    assert.equal(meta[base + (LEN - 1) * 4 + 1], 1);
  }
});

test('line segments never join two different strands', () => {
  const idx = buildSegmentIndices(STRANDS, LEN);
  assert.equal(idx.length, STRANDS * (LEN - 1) * 2);
  for (let i = 0; i < idx.length; i += 2) {
    assert.equal(Math.floor(idx[i] / LEN), Math.floor(idx[i + 1] / LEN));
    assert.equal(idx[i + 1] - idx[i], 1);
  }
});

test('large clouds get 32-bit indices', () => {
  assert.ok(buildSegmentIndices(1500, 48) instanceof Uint32Array);
  assert.ok(buildSegmentIndices(380, 30) instanceof Uint16Array);
});

test('curve passes through its control points and clamps outside them', () => {
  const points = [[0, 1], [1, 3], [2, 2], [4, 5]] as const;
  for (const [x, y] of points) assert.ok(Math.abs(curve(points, x) - y) < 1e-9);
  assert.equal(curve(points, -1), 1);
  assert.equal(curve(points, 9), 5);
});
