import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOOP, STATE_COUNT, hoopStackHalfHeight } from '../../src/scene/shapes.js';
import {
  CAMERA_Y,
  CAMERA_Z,
  FIT_HEIGHT,
  FIT_WIDTH,
  NOISE,
  SETTLE,
  STAGGER,
  fitCameraZ,
  fitCameraZHeight,
  sampleTrack,
} from '../../src/scene/tracks.js';

test('every track has one value per state', () => {
  for (const t of [CAMERA_Z, CAMERA_Y, SETTLE, STAGGER, NOISE, FIT_WIDTH, FIT_HEIGHT]) {
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

// Project a world point through the scene's Work framing: group tilted about
// x by sin(0.8) * 0.16 (Scene.update at progress 1), camera at (0, camY, z)
// looking at (0, camY * 0.35, 0), vertical fov 42°.
function toNdc([x, y, z], { camY, camZ, aspect, fov = 42 }) {
  const t = Math.sin(0.8) * 0.16;
  const p = [x, y * Math.cos(t) - z * Math.sin(t), y * Math.sin(t) + z * Math.cos(t)];
  const c = [0, camY, camZ];
  const f = [0, camY * 0.35 - camY, -camZ];
  const fl = Math.hypot(...f);
  const fw = f.map((v) => v / fl);
  const r = [-fw[2], 0, fw[0]]; // forward x up(0,1,0), normalised below
  const rl = Math.hypot(...r);
  const rt = r.map((v) => v / rl);
  const up = [
    rt[1] * fw[2] - rt[2] * fw[1],
    rt[2] * fw[0] - rt[0] * fw[2],
    rt[0] * fw[1] - rt[1] * fw[0],
  ];
  const d = p.map((v, i) => v - c[i]);
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const depth = dot(d, fw);
  const h = Math.tan((fov * Math.PI) / 360);
  return [dot(d, rt) / (depth * h * aspect), dot(d, up) / (depth * h)];
}

test('fitCameraZHeight keeps the whole Work hoop stack on screen', () => {
  for (const count of [6, 10]) {
    const half = hoopStackHalfHeight(count);
    for (const [w, h] of [[1440, 900], [1280, 720], [1920, 1080], [844, 390]]) {
      const aspect = w / h;
      const camY = CAMERA_Y[1];
      const baseZ = CAMERA_Z[1]; // frameScale is 1 on landscape screens
      const z = Math.max(
        fitCameraZ(baseZ, FIT_WIDTH[1], 42, aspect),
        fitCameraZHeight(baseZ, half, HOOP.radius + HOOP.tube, camY, 42)
      );
      for (let k = 0; k < count; k++) {
        const y0 = ((count - 1) / 2 - k) * HOOP.gap;
        for (const dy of [-HOOP.tube, HOOP.tube]) {
          for (const dr of [-HOOP.tube, HOOP.tube]) {
            for (let a = 0; a < 64; a++) {
              const ang = (a / 64) * Math.PI * 2;
              const r = HOOP.radius + dr;
              const [nx, ny] = toNdc([Math.cos(ang) * r, y0 + dy, Math.sin(ang) * r], { camY, camZ: z, aspect });
              assert.ok(Math.abs(ny) <= 1 && Math.abs(nx) <= 1, `${count} hoops ${w}x${h}: hoop ${k} at ndc (${nx.toFixed(2)}, ${ny.toFixed(2)})`);
            }
          }
        }
      }
    }
  }
});

test('fitCameraZHeight is a no-op without a stack, and stays finite', () => {
  assert.equal(fitCameraZHeight(5.2, 0, 1.51, 0.45, 42), 5.2);
  assert.equal(fitCameraZHeight(Number.NaN, 1.7, 1.51, 0.45, 42), Number.NaN);
  assert.ok(Number.isFinite(fitCameraZHeight(5.2, 50, 1.51, 0.45, 42)));
});

test('fitCameraZ stays finite on degenerate aspects', () => {
  assert.equal(fitCameraZ(5.2, 1.65, 42, 0), 5.2);
  assert.equal(fitCameraZ(5.2, 1.65, 42, Number.NaN), 5.2);
  assert.ok(Number.isFinite(fitCameraZ(5.2, 1.65, 42, 0.05)));
});
