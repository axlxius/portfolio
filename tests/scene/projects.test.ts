import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PROJECTS } from '../../src/data/content.ts';
import { TAKEOVER_IDS, buildTakeover } from '../../src/scene/projects.ts';

const STRANDS = 240;
const LEN = 20;

test('every project has a takeover shape', () => {
  for (const project of PROJECTS) {
    assert.ok(TAKEOVER_IDS.includes(project.visual), `${project.slug} has no shape`);
  }
});

test('takeover shapes are finite, bounded and the right size', () => {
  for (const id of TAKEOVER_IDS) {
    const arr = buildTakeover(id, STRANDS, LEN);
    assert.equal(arr.length, STRANDS * LEN * 3);
    for (let i = 0; i < arr.length; i += 3) {
      assert.ok(Number.isFinite(arr[i]) && Number.isFinite(arr[i + 1]) && Number.isFinite(arr[i + 2]), `${id} has a bad point`);
      assert.ok(Math.hypot(arr[i], arr[i + 1], arr[i + 2]) < 3.2, `${id} is too large`);
    }
  }
});

test('takeover shapes are cached per size', () => {
  assert.equal(buildTakeover('site', STRANDS, LEN), buildTakeover('site', STRANDS, LEN));
  assert.notEqual(buildTakeover('site', STRANDS, LEN), buildTakeover('site', STRANDS, LEN + 1));
});

test('each project has a distinct shape', () => {
  const seen = new Set<string>();
  for (const id of TAKEOVER_IDS) {
    const arr = buildTakeover(id, STRANDS, LEN);
    const key = Array.from(arr.subarray(0, 60)).map((v) => v.toFixed(3)).join(',');
    assert.ok(!seen.has(key), `${id} repeats another shape`);
    seen.add(key);
  }
});
