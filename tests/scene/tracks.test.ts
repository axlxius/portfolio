import assert from 'node:assert/strict';
import { test } from 'node:test';

import { STATE_COUNT } from '../../src/scene/shapes.ts';
import * as tracks from '../../src/scene/tracks.ts';

const { sampleTrack, fitCameraZ, ...arrays } = tracks;

test('every track has one value per morph state', () => {
  for (const [name, track] of Object.entries(arrays)) {
    assert.ok(Array.isArray(track), `${name} should be an array`);
    assert.equal((track as number[]).length, STATE_COUNT, `${name} has the wrong length`);
  }
});

test('sampleTrack interpolates between states and clamps at the ends', () => {
  const track = [0, 10, 30];
  assert.equal(sampleTrack(track, 0), 0);
  assert.equal(sampleTrack(track, 0.5), 5);
  assert.equal(sampleTrack(track, 1), 10);
  assert.equal(sampleTrack(track, 1.25), 15);
  assert.equal(sampleTrack(track, -3), 0);
  assert.equal(sampleTrack(track, 99), 30);
});

test('fitCameraZ never comes closer than the base distance', () => {
  for (const aspect of [0.4, 0.75, 1, 1.78, 2.4]) {
    for (const fit of [0, 1.1, 2.6]) {
      assert.ok(fitCameraZ(7, fit, 42, aspect) >= 7);
    }
  }
});

test('fitCameraZ backs off further as the viewport narrows', () => {
  const wide = fitCameraZ(7, 2, 42, 1.78);
  const narrow = fitCameraZ(7, 2, 42, 0.5);
  assert.ok(narrow > wide);
});

test('fitCameraZ survives a degenerate aspect', () => {
  assert.equal(fitCameraZ(7, 2, 42, 0), 7);
  assert.equal(fitCameraZ(7, 2, 42, Number.NaN), 7);
});
