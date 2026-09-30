# Background Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the tidied strand scene (project hoops, braided column, wire spheres, settling at rest), the stationary pulsing corner dots, and the small-screen fixes, with none of the prototype's rejected code.

**Architecture:** The scene stays one persistent Three.js object morphing through five target sets. Pure logic moves into two new small modules that Node can test without a browser: `bands.js` (project-band maths) and `tracks.js` (per-section tuning tracks and camera fitting). `shapes.js` swaps three builders. `Scene.js` reads the tracks every frame. The corner dots are an independent 2D canvas.

**Tech Stack:** Vite 5, Three.js 0.169 (`ShaderMaterial`, GLSL ES 1.0), Lenis, plain ES modules, Node 24's built-in `node:test` (no new dependencies).

**Spec:** `docs/superpowers/specs/2026-09-30-background-refresh-design.md`

## Global Constraints

- No new runtime or dev dependencies. Tests use `node:test` and `node:assert/strict`.
- Intro (state 0) and Contact (state 4) target positions must be byte-for-byte what `main` produces today (fingerprints below).
- Intro keeps settle 0, stagger 0.55, drift 0.12.
- Tracks, exactly: `SETTLE [0, 1, 1, 1, 1]`, `STAGGER [0.55, 0.32, 0.32, 0.32, 0.32]`, `NOISE [0.12, 0.03, 0.04, 0.03, 0.12]`, `CAMERA_Y [0.0, 0.45, 0.0, 0.1, 0.0]`, `CAMERA_Z [6.4, 5.2, 7.2, 8.4, 7.6]` (unchanged), `FIT_WIDTH [0, 1.65, 1.25, 0, 0]`.
- Hoops: radius 1.4, tube 0.11, gap 0.64. Braid: radius 1.05, 0.6 turns, half-height 3.4, waist 0.22.
- Glow edge `outer` = half the smallest circular gap between bands, floored at 0.02; `inner = 0.82 · outer`. Lit dots grow 0.45×.
- Corner dots: `min(440px, 70vw)` square, 18 px grid, top-right, frozen under reduced motion, independent of WebGL.
- Header fade: solid paper to 55%, clear at 100%, height `calc(clamp(1rem, 2.5vw, 2rem) * 2 + 2.6rem)`, home page only.
- Dot size `3.2 · clamp(height / 900, 0.6, 1.1)`.
- Nothing from `src/dev/`, `DotRain.js`, `nerveShapes.js`, the terrain builder, `variant`, `setFade`, or pulse code (`uPulse`, `aU`, `buildStrandU`) ships.
- Do not push or merge to `main`: pushing `main` deploys to production. Stop at a finished, committed branch.

Fingerprints of today's `main` (computed from `git show main:src/scene/shapes.js`). `sum` is the plain sum of all coordinates; `weighted` is `Σ v² · ((k mod 7) + 1)` over the flat array index `k`:

| strands × points | state | sum | weighted |
|---|---|---|---|
| 220 × 28 | 0 | 486.182692 | 69739.589311 |
| 220 × 28 | 4 | 3291.545679 | 74079.569863 |
| 110 × 20 | 0 | 409.833797 | 24545.714788 |
| 110 × 20 | 4 | 1105.578634 | 28591.948472 |

## Review Focus

1. **A project is added or removed.** Hoops should follow the row count and hovering should still light exactly one hoop. Covered by the 7-band hoop test in Task 3 and the 7-band edge test in Task 1.
2. **Two rows share a `data-strand` value, or values are bunched up.** A zero gap would make `outer` 0 and hover would light nothing. The 0.02 floor keeps hover working; test in Task 1.
3. **A row's `data-strand` is missing, empty, non-numeric or outside 0–1** (e.g. `""`, `"abc"`, `"1.05"`). Expected: bad values are ignored and out-of-range values wrap, not `NaN` positions. `parseBands` tests in Task 1, plus an all-finite test in Task 3.
4. **No project rows at all** (e.g. the list is edited out). Expected: the Work form still renders as a single hoop instead of crashing. Test in Task 3 (`projectBands: []`).
5. **Extreme aspect ratios** (very narrow portrait, or aspect 0 during a resize glitch). Expected: the camera distance stays finite and falls back to the base distance, never `Infinity` or `NaN`. Tests in Task 2.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `src/scene/bands.js` | create | Parse `data-strand` values; circular distance; nearest band; hover glow edges |
| `src/scene/tracks.js` | create | Per-section tuning tracks, `sampleTrack`, `fitCameraZ` |
| `src/scene/shapes.js` | modify | Swap builders 1–3 for hoops, braid, wire spheres; pass options to builders |
| `src/scene/shaders.js` | modify | `uSettle`, `uFocusEdge`, `uDepthShift`, `uGlowSize` |
| `src/scene/Scene.js` | modify | Accept `projectBands`; drive tracks per frame; fit camera; scale dots |
| `src/scene/CornerDots.js` | create | Stationary pulsing dot patch (2D canvas) |
| `src/main.js` | modify | Read bands from the page; wire corner dots |
| `index.html` | modify | Corner-dots canvas element |
| `src/styles/layout.css` | modify | Corner-dots placement; header fade |
| `tests/scene/*.test.js` | create | Node tests for the three pure modules |
| `package.json` | modify | `"test": "node --test"` |
| `README.md`, `.gitignore` | modify | Docs; ignore Playwright scratch output |

---

### Task 0: Branch setup

**Files:** none changed; carries the spec and this plan onto a clean branch.

- [ ] **Step 1: Create the branch from `main`**

```powershell
git switch main
git switch -c feature/background-refresh
git checkout explore/backgrounds -- docs/superpowers/specs/2026-09-30-background-refresh-design.md docs/superpowers/plans/2026-09-30-background-refresh.md
git commit -m "Add background refresh spec and plan"
```

Expected: `git status --short` is empty afterwards and `src/` matches `main` (no prototype files: `Test-Path src/dev` is `False`).

---

### Task 1: Project-band maths (`bands.js`) and the test runner

**Files:**
- Create: `src/scene/bands.js`
- Create: `tests/scene/bands.test.js`
- Modify: `package.json` (scripts)

**Interfaces:**
- Produces:
  - `circularDistance(a: number, b: number): number` in [0, 0.5]
  - `parseBands(values: Array<string|number|null|undefined>): number[]`, valid values wrapped into [0, 1), invalid dropped, order kept
  - `nearestBand(seed: number, bands: number[]): number`, index of the nearest band (first wins on ties), `-1` if `bands` is empty
  - `focusEdges(bands: number[]): { inner: number, outer: number }`

- [ ] **Step 1: Add the test script**

In `package.json`, add `"test": "node --test"` to `scripts`:

```json
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "node --test"
  },
```

- [ ] **Step 2: Write the failing tests**

Create `tests/scene/bands.test.js`:

```js
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
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm test`
Expected: FAIL, `Cannot find module ... src/scene/bands.js`.

- [ ] **Step 4: Implement `src/scene/bands.js`**

```js
// Project bands: each project row carries a data-strand value in [0, 1). A
// strand belongs to the project whose value is nearest its seed, measured
// around a circle so 0.95 and 0.05 are neighbours. The shader measures the
// same way when a row is hovered.

/** Distance between two values on the unit circle, in [0, 0.5]. */
export function circularDistance(a, b) {
  return Math.abs(((((a - b) % 1) + 1.5) % 1) - 0.5);
}

/** data-strand strings -> numbers in [0, 1). Junk is dropped, order kept. */
export function parseBands(values) {
  const out = [];
  for (const raw of values) {
    if (raw === '' || raw == null) continue;
    const v = Number(raw);
    if (!Number.isFinite(v)) continue;
    out.push(((v % 1) + 1) % 1);
  }
  return out;
}

/** Index of the band nearest `seed` (first wins a tie), or -1 if none. */
export function nearestBand(seed, bands) {
  let best = -1;
  let bestD = Infinity;
  bands.forEach((b, k) => {
    const d = circularDistance(seed, b);
    if (d < bestD) {
      bestD = d;
      best = k;
    }
  });
  return best;
}

// Below this the glow band would be too thin to see.
const MIN_EDGE = 0.02;

/**
 * Hover glow edges in seed space. `outer` is half the smallest gap between
 * neighbouring bands, so a lit project never bleeds into the next one.
 */
export function focusEdges(bands) {
  if (bands.length < 2) return { inner: 0.41, outer: 0.5 };

  const sorted = [...bands].sort((a, b) => a - b);
  let gap = 1 - sorted[sorted.length - 1] + sorted[0]; // around the wrap
  for (let i = 1; i < sorted.length; i++) {
    gap = Math.min(gap, sorted[i] - sorted[i - 1]);
  }

  const outer = Math.max(gap / 2, MIN_EDGE);
  return { inner: outer * 0.82, outer };
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm test`
Expected: all 7 tests PASS.

- [ ] **Step 6: Commit**

```powershell
git add package.json src/scene/bands.js tests/scene/bands.test.js
git commit -m "Add project-band maths with node:test coverage"
```

---

### Task 2: Per-section tracks and camera fitting (`tracks.js`)

**Files:**
- Create: `src/scene/tracks.js`
- Create: `tests/scene/tracks.test.js`

**Interfaces:**
- Consumes: `STATE_COUNT` from `src/scene/shapes.js` (tests only).
- Produces:
  - `CAMERA_Z`, `CAMERA_Y`, `SETTLE`, `STAGGER`, `NOISE`, `FIT_WIDTH`: `number[]` of length 5
  - `sampleTrack(track: number[], progress: number): number`, linear interpolation, clamped to the ends
  - `fitCameraZ(baseZ: number, fit: number, fovDeg: number, aspect: number): number`

- [ ] **Step 1: Write the failing tests**

Create `tests/scene/tracks.test.js`:

```js
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL, `Cannot find module ... src/scene/tracks.js`. The Task 1 tests still pass.

- [ ] **Step 3: Implement `src/scene/tracks.js`**

```js
// Per-section tuning. One value per morph state (Intro, Work, Experience,
// Stack, Contact), sampled at the eased scroll progress so every knob moves
// smoothly with the morph.

// Camera distance and height. Each form is framed deliberately rather than all
// at one focal length. The hoops read best from near level.
export const CAMERA_Z = [6.4, 5.2, 7.2, 8.4, 7.6];
export const CAMERA_Y = [0.0, 0.45, 0.0, 0.1, 0.0];

// How fully a form settles when its section is centred. 0 keeps the hero's
// half-woven swirl; 1 lands the reading sections as clean, finished shapes.
export const SETTLE = [0, 1, 1, 1, 1];

// Per-strand morph offset. Shorter after the hero so the in-between moments,
// the messiest frames, pass quickly.
export const STAGGER = [0.55, 0.32, 0.32, 0.32, 0.32];

// Ambient drift: calm while a text-heavy section is being read.
export const NOISE = [0.12, 0.03, 0.04, 0.03, 0.12];

// Half-width (world units) that must stay inside the frame. On narrow
// screens the camera backs off until it fits. 0 = free to run off the edges.
export const FIT_WIDTH = [0, 1.65, 1.25, 0, 0];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Sample a per-state track at a fractional progress value. */
export function sampleTrack(track, progress) {
  const p = clamp(progress, 0, track.length - 1);
  const i = Math.floor(p);
  const j = Math.min(i + 1, track.length - 1);
  return track[i] + (track[j] - track[i]) * (p - i);
}

/**
 * Camera distance that keeps `fit` world units of half-width in view.
 * Never closer than `baseZ`; falls back to `baseZ` on a degenerate aspect.
 */
export function fitCameraZ(baseZ, fit, fovDeg, aspect) {
  if (!(fit > 0)) return baseZ;
  const halfTan = Math.tan((fovDeg * Math.PI) / 360) * aspect;
  if (!(halfTan > 0)) return baseZ;
  return Math.max(baseZ, (fit * 1.08) / halfTan + fit * 0.5);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: all Task 1 and Task 2 tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/scene/tracks.js tests/scene/tracks.test.js
git commit -m "Add per-section tracks and camera width fitting"
```

---

### Task 3: New forms in `shapes.js`

**Files:**
- Modify: `src/scene/shapes.js` (replace `recedingPlane`, `helixColumn`, `clusters`; update `BUILDERS` and `buildStates`)
- Create: `tests/scene/shapes.test.js`

**Interfaces:**
- Consumes: `nearestBand` from `src/scene/bands.js`.
- Produces:
  - `buildStates(strands, pointsPerStrand, options = {}): Float32Array[]`, where `options.projectBands: number[]` (default `[]`)
  - `buildSeeds`, `buildSegmentIndices`, `STATE_COUNT` unchanged
  - `braidAngle(s: number, strands: number, u: number): number` (exported for tests)
  - `HOOP = { radius: 1.4, tube: 0.11, gap: 0.64 }`, `BRAID = { radius: 1.05, turns: 0.6, halfHeight: 3.4, waist: 0.22 }` (exported for tests)

- [ ] **Step 1: Write the failing tests**

Create `tests/scene/shapes.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BRAID,
  HOOP,
  STATE_COUNT,
  braidAngle,
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

test('all states are finite, even with messy bands', () => {
  for (const bands of [SIX, [], [0.3, 0.3], [0.999, 0.001]]) {
    for (const arr of buildStates(110, 20, { projectBands: bands })) {
      assert.ok(arr.every(Number.isFinite));
    }
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL, `The requested module '../../src/scene/shapes.js' does not provide an export named 'BRAID'`.

- [ ] **Step 3: Replace the three builders**

In `src/scene/shapes.js`, add this import as the first line after the header comment block:

```js
import { nearestBand } from './bands.js';
```

Delete the functions `recedingPlane`, `helixColumn` and `clusters` (the "State 1 — Work", "State 2 — Experience" and "State 3 — Stack" blocks), and put this in their place, between `torusKnot` and `convergence`:

```js
// State 1 — Work. One hoop per project, stacked top to bottom in list order.
// A strand joins the hoop of the project whose data-strand value is nearest
// its seed, so hovering a row lights exactly that hoop.
export const HOOP = { radius: 1.4, tube: 0.11, gap: 0.64 };

function projectHoops(out, strands, len, _rand, { projectBands = [] } = {}) {
  const bands = projectBands.length ? projectBands : [0.5];
  const seeds = buildSeeds(strands, len);

  const hoopOf = new Array(strands);
  const slot = new Array(strands);
  const counts = new Array(bands.length).fill(0);
  for (let s = 0; s < strands; s++) {
    const k = nearestBand(seeds[s * len], bands);
    hoopOf[s] = k;
    slot[s] = counts[k]++;
  }

  for (let s = 0; s < strands; s++) {
    const k = hoopOf[s];
    const y0 = ((bands.length - 1) / 2 - k) * HOOP.gap;
    // Where this strand sits on the hoop's cross-section.
    const ta = (slot[s] / counts[k]) * TAU;
    const r = HOOP.radius + Math.cos(ta) * HOOP.tube;
    const y = y0 + Math.sin(ta) * HOOP.tube;

    for (let l = 0; l < len; l++) {
      // Each strand is an arc at exactly the angles it has in the braid, so
      // Work -> Experience is a vertical stretch rather than points crossing
      // the shape. Overlapping arcs close each hoop.
      const a = braidAngle(s, strands, l / (len - 1));
      const i = (s * len + l) * 3;
      out[i] = Math.cos(a) * r;
      out[i + 1] = y;
      out[i + 2] = Math.sin(a) * r;
    }
  }
}

// State 2 — Experience. Every strand is the same helix, evenly phased, with
// alternate strands twisting the other way, so the column reads as woven.
export const BRAID = { radius: 1.05, turns: 0.6, halfHeight: 3.4, waist: 0.22 };

export function braidAngle(s, strands, u) {
  const dir = s % 2 === 0 ? 1 : -1;
  return (s / strands) * TAU + dir * u * TAU * BRAID.turns;
}

function braidColumn(out, strands, len) {
  for (let s = 0; s < strands; s++) {
    for (let l = 0; l < len; l++) {
      const u = l / (len - 1);
      const a = braidAngle(s, strands, u);
      const r = BRAID.radius * (1 - Math.sin(u * Math.PI) * BRAID.waist);

      const i = (s * len + l) * 3;
      out[i] = Math.cos(a) * r;
      out[i + 1] = (u - 0.5) * 2 * BRAID.halfHeight;
      out[i + 2] = Math.sin(a) * r;
    }
  }
}

// State 3 — Stack. Seven small wireframe spheres of latitude rings, on the
// same centres the old clusters used, each tilted a little differently.
function wireSpheres(out, strands, len) {
  const K = 7;
  const centres = [];
  for (let k = 0; k < K; k++) {
    const u = k / (K - 1);
    centres.push([
      (u - 0.5) * 7.6,
      Math.sin(u * Math.PI * 1.6) * 0.95 - 0.1,
      Math.cos(u * Math.PI * 1.2) * 1.4,
    ]);
  }

  const per = Math.floor(strands / K);
  for (let s = 0; s < strands; s++) {
    const k = Math.min(Math.floor(s / per), K - 1);
    const first = k * per;
    const count = k === K - 1 ? strands - first : per;
    const ring = s - first;
    const c = centres[k];
    const r = 0.5 + 0.12 * Math.sin(k * 1.7);
    const tilt = 0.35 + k * 0.23;

    // Latitude rings from pole to pole, each a closed loop.
    const lat = ((ring + 0.5) / count) * Math.PI;
    const ringR = Math.sin(lat) * r;
    const ringY = Math.cos(lat) * r;

    for (let l = 0; l < len; l++) {
      const a = (l / (len - 1)) * TAU;
      const x = Math.cos(a) * ringR;
      const z = Math.sin(a) * ringR;
      // Rotate about x by `tilt`.
      const y2 = ringY * Math.cos(tilt) - z * Math.sin(tilt);
      const z2 = ringY * Math.sin(tilt) + z * Math.cos(tilt);

      const i = (s * len + l) * 3;
      out[i] = c[0] + x;
      out[i + 1] = c[1] + y2;
      out[i + 2] = c[2] + z2;
    }
  }
}
```

- [ ] **Step 4: Update `BUILDERS` and `buildStates`**

Replace the `BUILDERS` line and the `buildStates` function with:

```js
const BUILDERS = [torusKnot, projectHoops, braidColumn, wireSpheres, convergence];

export const STATE_COUNT = BUILDERS.length;

/**
 * Build one Float32Array of xyz targets per state.
 * Each builder gets its own seeded PRNG so states stay independent and stable;
 * the seed depends only on the state's index, which is why Intro and Contact
 * are unchanged by edits to the states between them.
 * `options.projectBands` is the list of data-strand values, in list order.
 */
export function buildStates(strands, pointsPerStrand, options = {}) {
  const count = strands * pointsPerStrand;
  return BUILDERS.map((build, index) => {
    const arr = new Float32Array(count * 3);
    build(arr, strands, pointsPerStrand, mulberry32(0x9e37 + index * 7919), options);
    return arr;
  });
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm test`
Expected: all tests in the three files PASS. If the Intro/Contact fingerprint fails, a builder's position in `BUILDERS` or `torusKnot`/`convergence` itself changed. Undo that, don't update the expected numbers.

- [ ] **Step 6: Commit**

```powershell
git add src/scene/shapes.js tests/scene/shapes.test.js
git commit -m "Work hoops, braided Experience column and wire-sphere Stack"
```

---

### Task 4: Shader and `Scene.js`: settling, hover edges, fitting, dot size

**Files:**
- Modify: `src/scene/shaders.js`
- Modify: `src/scene/Scene.js`
- Modify: `src/main.js` (pass `projectBands`; hover handlers)

**Interfaces:**
- Consumes: `focusEdges`, `parseBands` (bands.js); every export of tracks.js; `buildStates(…, { projectBands })` (shapes.js).
- Produces: `new Scene(canvas, { reducedMotion, projectBands })`. Public methods unchanged: `setProgress`, `setFocus`, `setInk`, `update`, `resize`, `dispose`, plus the writable `progress` field used by `main.js`.

- [ ] **Step 1: Shader uniforms**

In `src/scene/shaders.js`, `VERTEX_COMMON`, replace

```glsl
uniform float uFocus;
uniform float uFocusBand;
```

with

```glsl
uniform float uFocus;
uniform float uFocusBand;
uniform vec2  uFocusEdge;   // (inner, outer) glow edge in seed space
uniform float uSettle;      // 0..1: how far the stagger fades out at rest
uniform float uDepthShift;  // camera pull-back that should not dim the fog
```

- [ ] **Step 2: Settle the stagger**

In `morphedViewPosition()`, replace

```glsl
  float p = clamp(
    uProgress + (aSeed - 0.5) * uStagger,
```

with

```glsl
  // The stagger fades out as progress lands on a whole state, so a centred
  // section shows its form fully built rather than half-morphed.
  float settle = mix(1.0, sin(3.14159265 * fract(uProgress)), uSettle);
  float p = clamp(
    uProgress + (aSeed - 0.5) * uStagger * settle,
```

- [ ] **Step 3: Depth fade and glow edge**

Replace `  float depth = -mv.z;` with

```glsl
  float depth = -mv.z - uDepthShift;
```

Replace `  vGlow = (1.0 - smoothstep(0.0, 0.13, bandDist)) * uFocus;` with

```glsl
  vGlow = (1.0 - smoothstep(uFocusEdge.x, uFocusEdge.y, bandDist)) * uFocus;
```

- [ ] **Step 4: Glow size on points**

In `pointsVertex`, replace

```glsl
uniform float uSize;
uniform float uPixelRatio;
```

with

```glsl
uniform float uSize;
uniform float uPixelRatio;
uniform float uGlowSize;
```

and replace `(1.0 + vGlow * 1.6)` with `(1.0 + vGlow * uGlowSize)`.

- [ ] **Step 5: `Scene.js` imports and constants**

Two replacements. First, replace the existing `import { ... } from './shapes.js';` statement with these three imports (leave the `three` and `./shaders.js` imports as they are):

```js
import {
  STATE_COUNT,
  buildSeeds,
  buildSegmentIndices,
  buildStates,
} from './shapes.js';
import { focusEdges } from './bands.js';
import {
  CAMERA_Y,
  CAMERA_Z,
  FIT_WIDTH,
  NOISE,
  SETTLE,
  STAGGER,
  fitCameraZ,
  sampleTrack,
} from './tracks.js';
```

Second, replace everything from `const DESKTOP = ...` down to and including the closing brace of `function sampleTrack(...)` (the `CAMERA_Z` / `CAMERA_Y` arrays and `sampleTrack` now live in `tracks.js`) with:

```js
const DESKTOP = { strands: 220, pointsPerStrand: 28 };
const MOBILE = { strands: 110, pointsPerStrand: 20 };

// Dots are sized in pixels but the object scales with viewport height.
const DOT_SIZE = 3.2;
// How much a lit strand's dots grow. A lift in brightness with a small size
// change reads as "this project" without the hoop turning heavy.
const GLOW_SIZE = 0.45;

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
```

- [ ] **Step 6: Constructor accepts `projectBands`**

Replace

```js
  constructor(canvas, { reducedMotion = false } = {}) {
    this.canvas = canvas;
    this.reducedMotion = reducedMotion;
```

with

```js
  constructor(canvas, { reducedMotion = false, projectBands = [] } = {}) {
    this.canvas = canvas;
    this.reducedMotion = reducedMotion;
    this.projectBands = projectBands;
```

- [ ] **Step 7: Geometry and uniforms**

In `#buildGeometry`, replace `const states = buildStates(strands, pointsPerStrand);` with

```js
    const states = buildStates(strands, pointsPerStrand, {
      projectBands: this.projectBands,
    });
    const edges = focusEdges(this.projectBands);
```

Replace the `this.uniforms = { ... };` object with

```js
    this.uniforms = {
      uProgress: { value: 0 },
      uTime: { value: 0 },
      uStagger: { value: STAGGER[0] },
      uNoise: { value: NOISE[0] },
      uSettle: { value: SETTLE[0] },
      uPointer: { value: new Vector2(0, 0) },
      uPointerStrength: { value: 0 },
      uAspect: { value: 1 },
      uFocus: { value: 0 },
      uFocusBand: { value: 0 },
      uFocusEdge: { value: new Vector2(edges.inner, edges.outer) },
      uDepthShift: { value: 0 },
      uInk: { value: new Color(0xffffff) },
      uPixelRatio: { value: 1 },
    };
```

and in the `pointsMaterial` uniforms replace `uSize: { value: 3.2 },` with

```js
        uSize: { value: DOT_SIZE },
        uGlowSize: { value: GLOW_SIZE },
```

- [ ] **Step 8: Dot size in `resize()`**

At the end of `resize()`, after `this.frameScale = ...`, add:

```js

    // Keep the dot-to-shape ratio roughly constant, so landscape phones don't
    // get chunky dots.
    this.pointsMaterial.uniforms.uSize.value = DOT_SIZE * clamp(height / 900, 0.6, 1.1);
```

- [ ] **Step 9: Tracks and camera in `update()`**

Replace

```js
    this.#setUniform('uProgress', this.progress);
```

with

```js
    this.#setUniform('uProgress', this.progress);
    this.#setUniform('uStagger', sampleTrack(STAGGER, this.progress));
    this.#setUniform('uNoise', sampleTrack(NOISE, this.progress));
    this.#setUniform('uSettle', sampleTrack(SETTLE, this.progress));
```

and replace

```js
    this.camera.position.z =
      sampleTrack(CAMERA_Z, this.progress) * this.frameScale;
    this.camera.position.y = sampleTrack(CAMERA_Y, this.progress);
```

with

```js
    const baseZ = sampleTrack(CAMERA_Z, this.progress) * this.frameScale;
    const z = fitCameraZ(
      baseZ,
      sampleTrack(FIT_WIDTH, this.progress),
      this.camera.fov,
      this.camera.aspect
    );
    this.camera.position.z = z;
    this.camera.position.y = sampleTrack(CAMERA_Y, this.progress);
    // The extra distance is only for framing: keep depth fog from dimming it.
    this.#setUniform('uDepthShift', z - baseZ);
```

- [ ] **Step 10: `main.js` passes the bands**

In `src/main.js`, add `import { parseBands } from './scene/bands.js';` after the `Scene` import. After `const sections = ...;` add:

```js
const strandRows = Array.from(document.querySelectorAll('[data-strand]'));
// Each project row owns one hoop of the Work form, in list order.
const projectBands = parseBands(strandRows.map((el) => el.dataset.strand));
```

Change `scene = new Scene(canvas, { reducedMotion });` to `scene = new Scene(canvas, { reducedMotion, projectBands });`.

Replace the hover block

```js
document.querySelectorAll('[data-strand]').forEach((el) => {
  const band = Number(el.dataset.strand);
```

with

```js
strandRows.forEach((el) => {
  const [band] = parseBands([el.dataset.strand]);
  if (band === undefined) return;
```

- [ ] **Step 11: Automated checks**

Run: `npm test`, then `npm run build`
Expected: tests PASS; build succeeds (the >500 kB warning may still appear until Task 7 confirms the final size).

- [ ] **Step 12: Visual check**

Start `npx vite --port 5173 --strictPort` in the background. With the Playwright browser tools at 1440×900 on `http://localhost:5173/`:
- scroll to each section centre (`[data-section]` centre minus half the viewport), wait 3.5 s, screenshot. Expected: knot (as today), six hoops, clean braided column, seven wire spheres, nerve bundle (as today).
- at Work, dispatch `pointerenter` on each `[data-strand]` row in turn (`pointerleave` between). Expected: exactly one hoop brightens each time, top to bottom in list order.
- scroll to midway between Work and Experience, wait 0.4 s, screenshot. Expected: an orderly crosshatch, not a scribble.
- `browser_console_messages` at level `warning`: no errors.

- [ ] **Step 13: Commit**

```powershell
git add src/scene/shaders.js src/scene/Scene.js src/main.js
git commit -m "Scene: settle at rest, per-project hover, width fitting, height-scaled dots"
```

---

### Task 5: Corner dots

**Files:**
- Create: `src/scene/CornerDots.js`
- Modify: `index.html` (one canvas element)
- Modify: `src/styles/layout.css` (placement)
- Modify: `src/main.js` (wiring)

**Interfaces:**
- Produces: `new CornerDots(canvas, { reducedMotion })` with `setInk(hex: string)`, `setFocus(bandOrNull: number|null)`, `update(dt: number)`, `resize()`, `dispose()`. Throws if a 2D context is unavailable.

- [ ] **Step 1: Create `src/scene/CornerDots.js`**

```js
// A stationary patch of dots in the top-right corner that slowly breathes.
//
// The dots never move. Their brightness pulses in a ripple that leaves the
// corner roughly every four seconds, and the patch fades out with distance so
// it has no hard edge. Plain 2D canvas: it does not depend on WebGL, so it
// survives when the 3D scene cannot start.

const SPACING = 18; // CSS px between dots

const lerp = (a, b, t) => a + (b - a) * t;

export default class CornerDots {
  constructor(canvas, { reducedMotion = false } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) throw new Error('2D canvas unavailable');
    this.reducedMotion = reducedMotion;

    this.ink = '0,0,0';
    this.focus = 0;
    this.focusTarget = 0;
    this.elapsed = 0;
    this.paused = false;

    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize, { passive: true });
    this.onVisibility = () => {
      this.paused = document.hidden;
    };
    document.addEventListener('visibilitychange', this.onVisibility);

    this.resize();
  }

  resize() {
    // The canvas is sized by CSS (min(440px, 70vw) square); match its pixels.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.size = this.canvas.clientWidth || 0;
    this.dpr = dpr;
    this.canvas.width = Math.round(this.size * dpr);
    this.canvas.height = Math.round(this.size * dpr);
  }

  /** Hovering a project gives the patch a small lift. */
  setFocus(bandOrNull) {
    this.focusTarget = bandOrNull == null ? 0 : 1;
  }

  setInk(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    this.ink = `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
  }

  update(dt) {
    if (this.paused || this.size === 0) return;
    this.focus = lerp(this.focus, this.focusTarget, 1 - Math.exp(-6 * dt));
    if (!this.reducedMotion) this.elapsed += dt;

    const { ctx, size, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const t = this.elapsed;
    const n = Math.ceil(size / SPACING);

    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        // Measured from the top-right corner.
        const x = size - (c + 0.5) * SPACING;
        const y = (r + 0.5) * SPACING;
        const d = Math.hypot(c + 0.5, r + 0.5) * SPACING;

        // Soft quarter-circle mask so the patch dissolves into the page.
        const mask = Math.max(0, 1 - d / size) ** 1.6;
        if (mask < 0.01) continue;

        const wave = 0.5 + 0.5 * Math.sin(t * 1.5 - d * 0.03);
        const pulse = wave ** 3;

        const a = mask * (0.14 + 0.4 * pulse + 0.15 * this.focus);
        const s = 1.4 + pulse * 1.1 * mask;
        ctx.fillStyle = `rgba(${this.ink},${Math.min(a, 0.85)})`;
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
      }
    }
  }

  dispose() {
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibility);
  }
}
```

- [ ] **Step 2: Canvas element**

In `index.html`, directly **before** `<canvas class="scene" data-scene aria-hidden="true"></canvas>`, add:

```html
    <canvas class="corner-dots" data-corner-dots aria-hidden="true"></canvas>
```

(Before, so the strands draw over the dots where they meet.)

- [ ] **Step 3: Placement CSS**

In `src/styles/layout.css`, directly after the `:root[data-ready] .scene { opacity: 1; }` rule, add:

```css
/* Stationary dot patch in the top-right corner; see src/scene/CornerDots.js. */
.corner-dots {
  position: fixed;
  top: 0;
  right: 0;
  width: min(440px, 70vw);
  aspect-ratio: 1 / 1;
  z-index: 0;
  pointer-events: none;
  opacity: 0;
  transition: opacity 1.2s var(--ease);
}

:root[data-ready] .corner-dots {
  opacity: 1;
}
```

- [ ] **Step 4: Wire it in `main.js`**

Add `import CornerDots from './scene/CornerDots.js';` above the `Scene` import. After the WebGL `try { ... } catch { ... }` block, add:

```js
// The corner dots are plain 2D, so they stay even if WebGL failed above.
const dotsCanvas = document.querySelector('[data-corner-dots]');
let cornerDots = null;
try {
  if (dotsCanvas) cornerDots = new CornerDots(dotsCanvas, { reducedMotion });
} catch (error) {
  console.warn('Corner dots unavailable, continuing without them.', error);
  dotsCanvas?.remove();
}
```

Change the theme hook to

```js
createTheme({
  onChange: (_mode, ink) => {
    scene?.setInk(ink);
    cornerDots?.setInk(ink);
  },
});
```

In the hover block change the two handlers to

```js
  const focus = () => {
    scene?.setFocus(band);
    cornerDots?.setFocus(band);
  };
  const release = () => {
    scene?.setFocus(null);
    cornerDots?.setFocus(null);
  };
```

In `frame()`, after the `if (scene) { ... }` block, add:

```js
  if (dt > 0) cornerDots?.update(dt);
```

- [ ] **Step 5: Checks**

Run: `npm test` and `npm run build`. Expected: PASS; build succeeds.
Visual at 1440×900: the dot patch is in the top-right in light mode; click `[data-theme-toggle]`, and it turns white on black along with the strands. Two screenshots about 1 s apart differ in the corner (it pulses). With `browser_run_code_unsafe` running `await page.emulateMedia({ reducedMotion: 'reduce' })` and a reload, two screenshots 1 s apart are identical in the corner. No console errors.

- [ ] **Step 6: Commit**

```powershell
git add src/scene/CornerDots.js index.html src/styles/layout.css src/main.js
git commit -m "Add stationary pulsing corner dots"
```

---

### Task 6: Header fade

**Files:**
- Modify: `src/styles/layout.css`

- [ ] **Step 1: Add the fade**

Directly after the `.chrome > * { pointer-events: auto; }` rule, add:

```css
/* Content scrolls under the fixed header; fade it out behind the wordmark
   rather than letting the two sets of type collide. Full-bleed, so it is
   pinned to the viewport rather than the gutter-inset header box. */
.chrome::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: calc(clamp(1rem, 2.5vw, 2rem) * 2 + 2.6rem);
  background: linear-gradient(
    to bottom,
    var(--paper) 0%,
    var(--paper) 55%,
    rgb(var(--paper-rgb) / 0) 100%
  );
  z-index: -1;
  pointer-events: none;
}
```

- [ ] **Step 2: Visual check**

At 390×844, scroll to the Work section centre. Expected: project text passing under "Alexius Lee" is hidden or faded, and the wordmark, section marker and Dark button stay fully legible and clickable (click the toggle and confirm the theme changes). Repeat in dark mode: the fade is black, not white.

- [ ] **Step 3: Commit**

```powershell
git add src/styles/layout.css
git commit -m "Fade content under the fixed header"
```

---

### Task 7: Docs, cleanup and the full verification pass

**Files:**
- Modify: `README.md`
- Modify: `.gitignore`

- [ ] **Step 1: Ignore Playwright scratch output**

Append to `.gitignore`:

```
.playwright-mcp/
```

- [ ] **Step 2: README: "Adding a project"**

Replace the paragraph under `### Adding a project` with:

```markdown
Copy a `.work-item` block and give it a `data-strand` value between `0` and
`1`. Each row owns one hoop of the Work form, stacked in list order, and
hovering or focusing the row lights exactly that hoop. The number of hoops
follows the number of rows automatically. Space the values evenly (for six
rows: 0.05 / 0.22 / 0.38 / 0.55 / 0.72 / 0.89); the hover edge is derived from
the smallest gap, so bunched values give thinner hoops.
```

- [ ] **Step 3: README: forms table and settling**

In `## How the 3D works`, replace the Work, Experience and Stack rows of the table with:

```markdown
| Work | one hoop per project, stacked in list order |
| Experience | a braided column: identical helices, alternate strands twisting opposite ways |
| Stack | seven small wireframe spheres |
```

After the paragraph ending "…rather than snapping in lockstep.", add:

```markdown
That stagger fades out as each section is centred (`uSettle`), so a section at
rest shows its form fully built. The Intro is the exception: it keeps the full
stagger, which is what gives the knot its woven look. The Work hoops are laid
at exactly the angles their strands take in the Experience braid, so that
transition is a vertical stretch rather than points crossing the shape.
```

- [ ] **Step 4: README: tuning table**

Replace the `### Tuning` table with:

```markdown
| Knob | File |
| --- | --- |
| Point and strand counts | `DESKTOP` / `MOBILE` in `src/scene/Scene.js` |
| Dot size, hover dot growth | `DOT_SIZE` / `GLOW_SIZE` in `src/scene/Scene.js` |
| Line opacity | the lines `ShaderMaterial` in `src/scene/Scene.js` |
| Camera distance and height per section | `CAMERA_Z` / `CAMERA_Y` in `src/scene/tracks.js` |
| Morph spread, drift, settling per section | `STAGGER` / `NOISE` / `SETTLE` in `src/scene/tracks.js` |
| Width kept in frame on narrow screens | `FIT_WIDTH` in `src/scene/tracks.js` |
| Hoop and braid proportions | `HOOP` / `BRAID` in `src/scene/shapes.js` |
| The five forms themselves | the builder functions in `src/scene/shapes.js` |
| Corner dots | `src/scene/CornerDots.js`, placement in `src/styles/layout.css` |

`npm test` runs the Node tests in `tests/`. They check the forms (including
that the Intro and Contact forms have not changed), the hover band maths and
the camera fitting.
```

Then replace the paragraph that starts "Adding or removing a builder in `shapes.js`" with:

```markdown
Adding or removing a builder in `shapes.js` is enough to change the number of
states — `STATE_COUNT`, the shader attributes and the blend are all generated
from that array. The section count in `index.html` must match it, and every
array in `src/scene/tracks.js` needs one value per state (`npm test` checks
this).
```

- [ ] **Step 5: README: design notes, known gaps**

In `## Design notes`, replace "Hovering a project row lights its band of strands, which is motion answering an action rather than ambient decoration." with:

```markdown
Hovering a project row lights that project's hoop, which is motion answering an
action rather than ambient decoration. The one ambient exception is a small
patch of stationary dots in the top-right corner whose brightness breathes
outward from the corner; it never moves and freezes under reduced motion.
Content scrolling under the fixed header fades out behind it instead of
colliding with the wordmark.
```

In `## Accessibility and fallbacks`, add a bullet:

```markdown
- The corner dots are a plain 2D canvas: they still show if WebGL fails, are
  skipped silently if 2D canvas is unavailable, and are static under
  `prefers-reduced-motion`.
```

In `## Known gaps`, replace the `data-strand` bullet with:

```markdown
- Strand count (desktop 220, mobile 110) is chosen at load, so rotating a
  tablet across 720 px keeps the first count until refresh.
```

- [ ] **Step 6: Confirm nothing from the prototype shipped**

Run:

```powershell
Test-Path src/dev, src/scene/DotRain.js, src/scene/nerveShapes.js, src/scene/tidyShapes.js
git grep -n -E "variant|setFade|uPulse|aU\b|buildStrandU|recedingPlane|\?bg=" -- src index.html
```

Expected: four `False`, and `git grep` prints nothing.

- [ ] **Step 7: Build size**

Run: `npm test`, then `npm run build`
Expected: tests PASS. Record the `dist/assets/main-*.js` size. It should be back near 498 kB with no ">500 kB" warning. If it is still over, report the number in the final summary; do not raise `chunkSizeWarningLimit`.

- [ ] **Step 8: Device matrix**

With the dev server and Playwright browser tools, for each viewport 390×844, 844×390, 768×1024, 1280×720, 1920×1080:
- load `http://localhost:5173/`, wait 2 s;
- evaluate `document.documentElement.scrollWidth - document.documentElement.clientWidth` and expect `0`;
- screenshot each of the five section centres (wait 3.5 s after each scroll).

Expected: Work hoops fully inside the width on every viewport and not faint on the phone; dots not chunky at 844×390; header fade hides text under the wordmark; no console errors at any size.

- [ ] **Step 9: WebGL-failure fallback**

With `browser_run_code_unsafe`, before loading the page, run
`await page.addInitScript(() => { const o = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { return /webgl/.test(t) ? null : o.call(this, t, ...a); }; });`
then load `http://localhost:5173/`. Expected: the page reads normally, `document.documentElement.hasAttribute('data-no-webgl')` is `true`, the corner dots still show, and the only console output is the existing "3D scene unavailable" warning.

- [ ] **Step 10: Clean up and commit**

```powershell
Remove-Item -Recurse -Force .playwright-mcp -ErrorAction SilentlyContinue
git add README.md .gitignore
git commit -m "Docs for the refreshed scene; ignore Playwright output"
git status --short
```

Expected: `git status --short` is empty. **Stop here.** Report to the owner: branch name, commits, test count, bundle size, and the screenshots' findings. Merging to `main` and pushing (which deploys) waits for their explicit go-ahead.
