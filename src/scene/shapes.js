// Target positions for every morph state.
//
// The scene is one persistent object: STRANDS filaments of POINTS_PER_STRAND
// points each. Every state below repositions the same strands, so the line
// segments connecting consecutive points survive the morph and read as threads
// being rewoven rather than particles teleporting.

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

// State 1 — Work. Strands lie flat as a mesh plane receding to a horizon.
function recedingPlane(out, strands, len, rand) {
  for (let s = 0; s < strands; s++) {
    const rowU = s / (strands - 1);
    const z = -7.5 + rowU * 9.5;
    const jitter = (rand() - 0.5) * 0.12;

    for (let l = 0; l < len; l++) {
      const u = l / (len - 1);
      const x = (u - 0.5) * 11;
      const y =
        -1.45 +
        Math.sin(x * 0.85 + z * 0.5) * 0.28 +
        Math.sin(z * 1.3) * 0.18 +
        jitter;

      const i = (s * len + l) * 3;
      out[i] = x;
      out[i + 1] = y;
      out[i + 2] = z + jitter;
    }
  }
}

// State 2 — Experience. Strands wind into a single twisted column.
function helixColumn(out, strands, len, rand) {
  const GOLDEN = Math.PI * (3 - Math.sqrt(5));

  for (let s = 0; s < strands; s++) {
    const phase = s * GOLDEN;
    const radius = 0.85 + (s / strands) * 0.55 + rand() * 0.14;
    const turns = 1.15 + rand() * 0.5;
    const yTop = 3.4 + rand() * 0.3;

    for (let l = 0; l < len; l++) {
      const u = l / (len - 1);
      const a = phase + u * TAU * turns;
      const taper = 1 - Math.abs(u - 0.5) * 0.35; // pinch the ends

      const i = (s * len + l) * 3;
      out[i] = Math.cos(a) * radius * taper;
      out[i + 1] = (u - 0.5) * 2 * yTop;
      out[i + 2] = Math.sin(a) * radius * taper;
    }
  }
}

// State 3 — Stack. Strands collapse into discrete clusters.
function clusters(out, strands, len, rand) {
  const K = 7;
  const centers = [];
  for (let k = 0; k < K; k++) {
    const u = K === 1 ? 0.5 : k / (K - 1);
    centers.push([
      (u - 0.5) * 7.6,
      Math.sin(u * Math.PI * 1.6) * 0.95 - 0.1,
      Math.cos(u * Math.PI * 1.2) * 1.4,
    ]);
  }

  for (let s = 0; s < strands; s++) {
    const c = centers[s % K];
    const spread = 0.42 + rand() * 0.3;

    // Random walk inside the cluster keeps consecutive points close, so the
    // connecting segments stay short instead of spraying across the cluster.
    let px = (rand() - 0.5) * spread;
    let py = (rand() - 0.5) * spread;
    let pz = (rand() - 0.5) * spread;
    const step = spread * 0.38;

    for (let l = 0; l < len; l++) {
      px += (rand() - 0.5) * step;
      py += (rand() - 0.5) * step;
      pz += (rand() - 0.5) * step;

      // Keep the walk from drifting out of the cluster.
      const d = Math.hypot(px, py, pz);
      if (d > spread) {
        const k = spread / d;
        px *= k;
        py *= k;
        pz *= k;
      }

      const i = (s * len + l) * 3;
      out[i] = c[0] + px;
      out[i + 1] = c[1] + py;
      out[i + 2] = c[2] + pz;
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

const BUILDERS = [torusKnot, recedingPlane, helixColumn, clusters, convergence];

export const STATE_COUNT = BUILDERS.length;

/**
 * Build one Float32Array of xyz targets per state.
 * Each builder gets its own seeded PRNG so states stay independent and stable.
 */
export function buildStates(strands, pointsPerStrand) {
  const count = strands * pointsPerStrand;
  return BUILDERS.map((build, index) => {
    const arr = new Float32Array(count * 3);
    build(arr, strands, pointsPerStrand, mulberry32(0x9e37 + index * 7919));
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
