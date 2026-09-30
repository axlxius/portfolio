import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BRAID,
  HOOP,
  STATE_COUNT,
  braidAngle,
  buildHoopIndex,
  buildSeeds,
  buildStates,
} from '../../src/scene/shapes.js';
import { nearestBand } from '../../src/scene/bands.js';

const SIX = [0.05, 0.22, 0.38, 0.55, 0.72, 0.89];
const EPS = 1e-4;

function fingerprint(arr) {
  let sum = 0;
  let weighted = 0;
  arr.forEach((v, k) => {
    sum += v;
    weighted += v * v * ((k % 7) + 1);
  });
  return [sum, weighted];
}

const pt = (arr, s, l, len) => {
  const i = (s * len + l) * 3;
  return [arr[i], arr[i + 1], arr[i + 2]];
};

test('five states', () => {
  assert.equal(STATE_COUNT, 5);
});

test('Intro and Contact are unchanged from main', () => {
  const expected = {
    '220x28': [[486.182692, 69739.589311], [3291.545679, 74079.569863]],
    '110x20': [[409.833797, 24545.714788], [1105.578634, 28591.948472]],
  };
  for (const [n, len] of [[220, 28], [110, 20]]) {
    const states = buildStates(n, len, { projectBands: SIX });
    const [intro, contact] = expected[`${n}x${len}`];
    for (const [idx, want] of [[0, intro], [4, contact]]) {
      const [sum, weighted] = fingerprint(states[idx]);
      assert.ok(Math.abs(sum - want[0]) < 1e-3, `state ${idx} sum ${sum}`);
      assert.ok(Math.abs(weighted - want[1]) < 1e-2, `state ${idx} weighted ${weighted}`);
    }
  }
});

function checkHoops(bands, n, len) {
  const hoops = buildStates(n, len, { projectBands: bands })[1];
  const seeds = buildSeeds(n, len);
  const count = bands.length || 1;
  const used = new Set();
  for (let s = 0; s < n; s++) {
    const k = bands.length ? nearestBand(seeds[s * len], bands) : 0;
    used.add(k);
    const y0 = ((count - 1) / 2 - k) * HOOP.gap;
    for (let l = 0; l < len; l++) {
      const [x, y, z] = pt(hoops, s, l, len);
      const r = Math.hypot(x, z);
      assert.ok(Math.abs(y - y0) <= HOOP.tube + EPS, `strand ${s} y ${y} vs hoop ${k}`);
      assert.ok(Math.abs(r - HOOP.radius) <= HOOP.tube + EPS, `strand ${s} r ${r}`);
    }
  }
  return used;
}

test('Work: each strand sits on its project hoop, in list order', () => {
  const used = checkHoops(SIX, 220, 28);
  assert.equal(used.size, 6);
  checkHoops(SIX, 110, 20);
});

test('Work: a seventh project gets a seventh hoop', () => {
  const seven = Array.from({ length: 7 }, (_, i) => (i + 0.5) / 7);
  assert.equal(checkHoops(seven, 220, 28).size, 7);
});

test('Work: no projects still renders one hoop', () => {
  assert.equal(checkHoops([], 220, 28).size, 1);
});

test('Work -> Experience is a vertical stretch (same angle per point)', () => {
  const states = buildStates(220, 28, { projectBands: SIX });
  for (let s = 0; s < 220; s++) {
    for (let l = 0; l < 28; l++) {
      const [x1, , z1] = pt(states[1], s, l, 28);
      const [x2, , z2] = pt(states[2], s, l, 28);
      const d = Math.atan2(z1, x1) - Math.atan2(z2, x2);
      const wrapped = Math.abs(Math.atan2(Math.sin(d), Math.cos(d)));
      assert.ok(wrapped < 1e-3, `strand ${s} point ${l} angle off by ${wrapped}`);
    }
  }
});

test('Experience: every strand is the same helix, evenly phased', () => {
  const braid = buildStates(220, 28)[2];
  for (let s = 0; s < 220; s++) {
    for (let l = 0; l < 28; l++) {
      const u = l / 27;
      const [x, y, z] = pt(braid, s, l, 28);
      const r = BRAID.radius * (1 - Math.sin(u * Math.PI) * BRAID.waist);
      assert.ok(Math.abs(Math.hypot(x, z) - r) < EPS);
      assert.ok(Math.abs(y - (u - 0.5) * 2 * BRAID.halfHeight) < EPS);
      const a = braidAngle(s, 220, u);
      assert.ok(Math.abs(x - Math.cos(a) * r) < EPS && Math.abs(z - Math.sin(a) * r) < EPS);
    }
  }
});

test('Stack: every point lies on one of seven small spheres', () => {
  const spheres = buildStates(220, 28)[3];
  const centres = Array.from({ length: 7 }, (_, k) => {
    const u = k / 6;
    return [(u - 0.5) * 7.6, Math.sin(u * Math.PI * 1.6) * 0.95 - 0.1, Math.cos(u * Math.PI * 1.2) * 1.4];
  });
  for (let i = 0; i < spheres.length; i += 3) {
    const d = Math.min(...centres.map((c) => Math.hypot(spheres[i] - c[0], spheres[i + 1] - c[1], spheres[i + 2] - c[2])));
    assert.ok(d <= 0.63, `point ${i / 3} is ${d} from the nearest centre`);
  }
});

// Hover lights strands whose hoop index equals the hovered row's. For that to
// light exactly the row's hoop, every strand's index must be the hoop the Work
// geometry actually drew it on, for any spacing of values.
function checkHoopIndex(bands, n, len) {
  const hoops = buildStates(n, len, { projectBands: bands })[1];
  const index = buildHoopIndex(n, len, bands);
  assert.equal(index.length, n * len);
  const count = bands.length || 1;
  const perHoop = new Array(count).fill(0);
  for (let s = 0; s < n; s++) {
    const k = index[s * len];
    assert.ok(Number.isInteger(k) && k >= 0 && k < count, `strand ${s} index ${k}`);
    perHoop[k] += 1;
    const y0 = ((count - 1) / 2 - k) * HOOP.gap;
    for (let l = 0; l < len; l++) {
      assert.equal(index[s * len + l], k, 'index is constant along a strand');
      const [, y] = pt(hoops, s, l, len);
      assert.ok(Math.abs(y - y0) <= HOOP.tube + EPS, `strand ${s} drawn off hoop ${k}`);
    }
  }
  return perHoop;
}

test('hover index: every strand is tagged with the hoop it is drawn on', () => {
  checkHoopIndex(SIX, 220, 28);
  checkHoopIndex(SIX, 110, 20);
});

test('hover index stays exact for uneven, added and removed rows', () => {
  checkHoopIndex([0.05, 0.22, 0.55, 0.72, 0.89], 220, 28); // a row removed
  checkHoopIndex([...SIX, 0.95], 220, 28); // a row added, not re-spaced
  const uneven = checkHoopIndex([0.05, 0.1, 0.5], 220, 28);
  assert.ok(uneven.every((c) => c > 0), 'every row owns strands');
  checkHoopIndex([], 220, 28);
});

test('all states are finite, even with messy bands', () => {
  for (const bands of [SIX, [], [0.3, 0.3], [0.999, 0.001]]) {
    for (const arr of buildStates(110, 20, { projectBands: bands })) {
      assert.ok(arr.every(Number.isFinite));
    }
  }
});
