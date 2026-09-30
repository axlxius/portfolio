// Target positions for every morph state.
//
// The scene is one persistent object: STRANDS filaments of POINTS_PER_STRAND
// points each. Every state below repositions the same strands, so the line
// segments connecting consecutive points survive the morph and read as threads
// being rewoven rather than particles teleporting.

import { nearestBand } from './bands.js';

const TAU = Math.PI * 2;

// Deterministic PRNG so the composition is identical on every load.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// State 0 — Hero. Strands woven around a (2,3) torus knot.
function torusKnot(out, strands, len, rand) {
  const R = 1.55;
  const r = 0.58;
  const p = 2;
  const q = 3;

  for (let s = 0; s < strands; s++) {
    const t0 = rand() * TAU;
    const span = 0.55 + rand() * 0.7; // how much of the knot this strand hugs
    const offRadius = 0.12 + rand() * 0.3;
    const offPhase = rand() * TAU;
    const offSpin = 2 + rand() * 4;

    for (let l = 0; l < len; l++) {
      const u = l / (len - 1);
      const t = t0 + u * span;

      const cx = (R + r * Math.cos(q * t)) * Math.cos(p * t);
      const cy = (R + r * Math.cos(q * t)) * Math.sin(p * t);
      const cz = r * Math.sin(q * t);

      // Offset the strand off the core curve so the knot reads as woven.
      const a = offPhase + t * offSpin;
      const ox = Math.cos(a) * offRadius;
      const oy = Math.sin(a) * offRadius;

      const i = (s * len + l) * 3;
      out[i] = cx + ox * Math.cos(p * t);
      out[i + 1] = cy + ox * Math.sin(p * t);
      out[i + 2] = cz + oy;
    }
  }
}

// State 1 — Work. One hoop per project, stacked top to bottom in list order.
// A strand joins the hoop of the project whose data-strand value is nearest
// its seed, so hovering a row lights exactly that hoop.
export const HOOP = { radius: 1.4, tube: 0.11, gap: 0.64 };

/** Half the height of a stack of `count` hoops, centre to outer tube edge. */
export function hoopStackHalfHeight(count) {
  return ((Math.max(count, 1) - 1) / 2) * HOOP.gap + HOOP.tube;
}

// Which hoop each strand belongs to, its slot within that hoop, and how many
// strands each hoop has. Shared by the geometry and the hover index so the two
// can never disagree.
function assignHoops(strands, len, projectBands) {
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
  return { bands, hoopOf, slot, counts };
}

/**
 * Per-point hoop index (constant along a strand). Hovering row k lights the
 * strands tagged k, which is exactly hoop k whatever the values' spacing.
 */
export function buildHoopIndex(strands, pointsPerStrand, projectBands = []) {
  const { hoopOf } = assignHoops(strands, pointsPerStrand, projectBands);
  const index = new Float32Array(strands * pointsPerStrand);
  for (let s = 0; s < strands; s++) {
    index.fill(hoopOf[s], s * pointsPerStrand, (s + 1) * pointsPerStrand);
  }
  return index;
}

function projectHoops(out, strands, len, _rand, { projectBands = [] } = {}) {
  const { bands, hoopOf, slot, counts } = assignHoops(strands, len, projectBands);

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

// State 4 — Contact. Everything converges on one quiet vertical axis.
function convergence(out, strands, len, rand) {
  for (let s = 0; s < strands; s++) {
    const phase = rand() * TAU;
    const yBase = (rand() - 0.5) * 5.2;
    const reach = 0.5 + rand() * 1.1;

    for (let l = 0; l < len; l++) {
      const u = l / (len - 1);
      // Points flare outward at the strand's head and taper to the axis.
      const radius = Math.pow(1 - u, 2.6) * reach;
      const a = phase + u * 1.1;

      const i = (s * len + l) * 3;
      out[i] = Math.cos(a) * radius;
      out[i + 1] = yBase + u * 0.85;
      out[i + 2] = Math.sin(a) * radius;
    }
  }
}

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

/**
 * Per-point seed in [0,1). Constant within a strand so a strand morphs and
 * highlights as a single thread rather than dissolving point by point.
 */
export function buildSeeds(strands, pointsPerStrand) {
  const rand = mulberry32(0xc0ffee);
  const seeds = new Float32Array(strands * pointsPerStrand);
  for (let s = 0; s < strands; s++) {
    const v = rand();
    for (let l = 0; l < pointsPerStrand; l++) seeds[s * pointsPerStrand + l] = v;
  }
  return seeds;
}

/**
 * Index pairs connecting consecutive points within each strand.
 * Strands never link to each other, so no segment ever spans the whole scene.
 */
export function buildSegmentIndices(strands, pointsPerStrand) {
  const segments = strands * (pointsPerStrand - 1);
  const Arr = strands * pointsPerStrand > 65535 ? Uint32Array : Uint16Array;
  const idx = new Arr(segments * 2);

  let w = 0;
  for (let s = 0; s < strands; s++) {
    const base = s * pointsPerStrand;
    for (let l = 0; l < pointsPerStrand - 1; l++) {
      idx[w++] = base + l;
      idx[w++] = base + l + 1;
    }
  }
  return idx;
}
