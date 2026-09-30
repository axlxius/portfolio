import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATE_COUNT } from '../../src/scene/shapes.js';
import {
  CAMERA_Y,
  CAMERA_Z,
  FIT_WIDTH,
  NOISE,
  SETTLE,
  STAGGER,
  fitCameraZ,
  sampleTrack,
} from '../../src/scene/tracks.js';

test('every track has one value per state', () => {
  for (const t of [CAMERA_Z, CAMERA_Y, SETTLE, STAGGER, NOISE, FIT_WIDTH]) {
    assert.equal(t.length, STATE_COUNT);
  }
});

test('intro keeps the original motion values', () => {
  assert.equal(SETTLE[0], 0);
  assert.equal(STAGGER[0], 0.55);
  assert.equal(NOISE[0], 0.12);
});

test('sampleTrack interpolates and clamps', () => {
  const t = [0, 10, 20];
  assert.equal(sampleTrack(t, 0), 0);
  assert.equal(sampleTrack(t, 0.5), 5);
  assert.equal(sampleTrack(t, 1.25), 12.5);
  assert.equal(sampleTrack(t, -3), 0);
  assert.equal(sampleTrack(t, 9), 20);
});

test('fitCameraZ leaves wide screens alone', () => {
  assert.equal(fitCameraZ(5.2, 1.65, 42, 1440 / 900), 5.2);
});

test('fitCameraZ backs off on a phone until the width fits', () => {
  const aspect = 390 / 844;
  const z = fitCameraZ(5.2, 1.65, 42, aspect);
  assert.ok(z > 5.2);
  const halfTan = Math.tan((42 * Math.PI) / 360) * aspect;
  // Near edge of the hoop (z - fit/2 from camera) must show the full width.
  assert.ok((z - 1.65 * 0.5) * halfTan >= 1.65 * 1.08 - 1e-9);
});

test('fitCameraZ ignores states with no width constraint', () => {
  assert.equal(fitCameraZ(6.4, 0, 42, 0.3), 6.4);
});

test('fitCameraZ stays finite on degenerate aspects', () => {
  assert.equal(fitCameraZ(5.2, 1.65, 42, 0), 5.2);
  assert.equal(fitCameraZ(5.2, 1.65, 42, Number.NaN), 5.2);
  assert.ok(Number.isFinite(fitCameraZ(5.2, 1.65, 42, 0.05)));
});
