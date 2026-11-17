// Target positions for every morph state.
//
// The scene is one persistent object: STRANDS filaments of POINTS_PER_STRAND
// points each. Every state repositions the same strands, so the hairlines
// joining consecutive points survive the morph and read as threads being
// rewoven rather than particles teleporting.
//
// Two rules keep the builders honest:
//
//  1. Any prefix of the strand list is a fair sample of the whole shape.
//     Groupings therefore come from `s % n` or a low-discrepancy sequence,
//     never from contiguous ranges. That lets the renderer drop quality by
//     simply drawing fewer strands.
//  2. Everything is deterministic, so the composition is identical on every
//     load and the tests can pin it down.

const TAU = Math.PI * 2;
// Conjugates of the golden and plastic ratios: evenly spread fractions.
const PHI = 0.6180339887498949;
const PLASTIC = 0.7548776662466927;

export type Vec3 = [number, number, number];
type Builder = (out: Float32Array, strands: number, len: number, rand: () => number) => void;

/** Deterministic PRNG (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const fract = (v: number) => v - Math.floor(v);

/** Roughly normal in [-1, 1], cheap. */
const gauss = (rand: () => number) => (rand() + rand() + rand() - 1.5) / 1.5;

function put(out: Float32Array, i: number, x: number, y: number, z: number) {
  out[i] = x;
  out[i + 1] = y;
  out[i + 2] = z;
}

/** Catmull-Rom through (x, y) control points with increasing x. */
export function curve(points: ReadonlyArray<readonly [number, number]>, x: number): number {
  const n = points.length;
  if (x <= points[0][0]) return points[0][1];
  if (x >= points[n - 1][0]) return points[n - 1][1];
  let i = 0;
  while (i < n - 2 && x > points[i + 1][0]) i++;
  const p0 = points[Math.max(i - 1, 0)][1];
  const p1 = points[i][1];
  const p2 = points[i + 1][1];
  const p3 = points[Math.min(i + 2, n - 1)][1];
  const t = (x - points[i][0]) / (points[i + 1][0] - points[i][0]);
  return (
    0.5 *
    (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t)
  );
}

// --- Shared strand layout -----------------------------------------------------

export const BANDS = 6; // one per project, top to bottom in list order
export const ROLES = 3; // one per role, top to bottom in list order

/** The Work band a strand belongs to. */
export const bandOf = (s: number) => s % BANDS;
/** The Experience segment a strand belongs to. */
export const roleOf = (s: number) => s % ROLES;

/**
 * Where a strand sits around the vertical axis, and how much of the circle it
 * covers. The vase and the column use the same angles, so Work to Experience
 * is a vertical stretch rather than points crossing the shape.
 */
function arcOf(s: number): { start: number; span: number } {
  return { start: fract(s * PLASTIC) * TAU, span: 0.55 + fract(s * PHI * 7.31) * 0.75 };
}

// --- State 0: Intro. A loose gyroscope of orbital rings. -----------------------

const RINGS: ReadonlyArray<{ r: number; tiltX: number; tiltZ: number }> = [
  { r: 2.45, tiltX: 0.22, tiltZ: 0.1 },
  { r: 2.1, tiltX: 1.12, tiltZ: 0.5 },
  { r: 1.78, tiltX: -0.72, tiltZ: 1.0 },
  { r: 1.46, tiltX: 1.5, tiltZ: -0.42 },
  { r: 1.16, tiltX: 0.52, tiltZ: -1.2 },
  { r: 0.86, tiltX: -1.2, tiltZ: 0.32 },
  { r: 0.52, tiltX: 0.9, tiltZ: 0.9 },
];

const gyroscope: Builder = (out, strands, len, rand) => {
  // Longer rings get proportionally more strands.
  const total = RINGS.reduce((sum, ring) => sum + ring.r, 0);
  const edges: number[] = [];
  let acc = 0;
  for (const ring of RINGS) edges.push((acc += ring.r / total));

  for (let s = 0; s < strands; s++) {
    const pick = fract(s * PHI);
    const k = Math.min(edges.findIndex((e) => pick < e), RINGS.length - 1);
    const ring = RINGS[k < 0 ? RINGS.length - 1 : k];

    // One strand in seven strays off its ring: the "loose" in loose gyroscope.
    const stray = rand() < 0.14;
    const spread = stray ? 0.34 : 0.045;
    const dr = gauss(rand) * spread;
    const dn = gauss(rand) * spread;
    const start = rand() * TAU;
    const span = (0.35 + rand() * 0.7) * (stray ? 0.6 : 1) * (1.6 / (0.6 + ring.r));
    const twist = 1.5 + rand() * 3;

    const cx = Math.cos(ring.tiltX), sx = Math.sin(ring.tiltX);
    const cz = Math.cos(ring.tiltZ), sz = Math.sin(ring.tiltZ);

    for (let l = 0; l < len; l++) {
      const u = l / (len - 1);
      const a = start + u * span;
      // The offset winds around the ring's core so it reads as spun thread.
      const w = u * twist * TAU * 0.25;
      const r = ring.r + dr * Math.cos(w) - dn * Math.sin(w) * 0.5;
      const x0 = Math.cos(a) * r;
      const y0 = dn * Math.cos(w) + dr * Math.sin(w) * 0.5;
      const z0 = Math.sin(a) * r;
      // Tilt about x, then about z.
      const y1 = y0 * cx - z0 * sx;
      const z1 = y0 * sx + z0 * cx;
      const x2 = x0 * cz - y1 * sz;
      const y2 = x0 * sz + y1 * cz;
      put(out, (s * len + l) * 3, x2, y2, z1);
    }
  }
};

// --- State 1: Work. A vase of stacked rings, one band per project. -------------

export const VASE = { height: 4.3, gap: 0.1, ringsPerBand: 8 };

/** Vase silhouette: radius against height (0 = foot, 1 = lip). */
const VASE_PROFILE: ReadonlyArray<readonly [number, number]> = [
  [0, 0.52],
  [0.07, 0.6],
  [0.36, 1.3],
  [0.64, 0.84],
  [0.83, 0.5],
  [0.93, 0.56],
  [1, 0.76],
];

export const vaseRadius = (yn: number) => curve(VASE_PROFILE, yn);

const vase: Builder = (out, strands, len, rand) => {
  const bandHeight = (VASE.height - VASE.gap * (BANDS - 1)) / BANDS;

  for (let s = 0; s < strands; s++) {
    const band = bandOf(s);
    const ring = Math.floor(fract(Math.floor(s / BANDS) * PHI) * VASE.ringsPerBand);
    // Band 0 is the lip, so the list order runs top to bottom.
    const top = VASE.height / 2 - band * (bandHeight + VASE.gap);
    // A little scatter gives each ring the thickness of spun thread rather
    // than stacking every strand on one perfect circle.
    const y = top - ((ring + 0.5) / VASE.ringsPerBand) * bandHeight + gauss(rand) * 0.016;
    const r = vaseRadius((y + VASE.height / 2) / VASE.height) + gauss(rand) * 0.03;
    const { start, span } = arcOf(s);

    for (let l = 0; l < len; l++) {
      const a = start + (l / (len - 1)) * span;
      put(out, (s * len + l) * 3, Math.cos(a) * r, y, Math.sin(a) * r);
    }
  }
};

// --- State 2: Experience. A tall column of stacked ellipses. --------------------

export const COLUMN = { height: 6.6, gap: 0.3, radius: 0.8, ringsPerRole: 11, tilt: 0.2 };

const column: Builder = (out, strands, len, rand) => {
  const segment = (COLUMN.height - COLUMN.gap * (ROLES - 1)) / ROLES;

  for (let s = 0; s < strands; s++) {
    const role = roleOf(s);
    const ring = Math.floor(fract(Math.floor(s / ROLES) * PHI) * COLUMN.ringsPerRole);
    // Role 0 is the newest and sits at the top, as in the list.
    const top = COLUMN.height / 2 - role * (segment + COLUMN.gap);
    const y = top - ((ring + 0.5) / COLUMN.ringsPerRole) * segment;
    // Each ring leans a little, and the lean precesses up the column, so the
    // stack reads as separate ellipses instead of a smooth tube.
    const lean = (role * COLUMN.ringsPerRole + ring) * 2.4;
    const { start, span } = arcOf(s);
    const r = COLUMN.radius + gauss(rand) * 0.028;
    const dy = gauss(rand) * 0.014;

    for (let l = 0; l < len; l++) {
      const a = start + (l / (len - 1)) * span;
      put(
        out,
        (s * len + l) * 3,
        Math.cos(a) * r,
        y + dy + Math.sin(a - lean) * COLUMN.tilt * r,
        Math.sin(a) * r
      );
    }
  }
};

// --- State 3: Stack. A flowing, twisting ribbon. --------------------------------

export const RIBBON = { length: 11, width: 1.7 };

const ribbon: Builder = (out, strands, len, rand) => {
  for (let s = 0; s < strands; s++) {
    const across = (fract(s * PHI) - 0.5) * RIBBON.width;
    const span = 2.2 + rand() * 2.6;
    const x0 = (rand() - 0.5) * (RIBBON.length - span) - span / 2;
    const lift = gauss(rand) * 0.03;

    for (let l = 0; l < len; l++) {
      const x = x0 + (l / (len - 1)) * span;
      const twist = x * 0.42 + 0.3;
      const cy = Math.sin(x * 0.62 + 0.5) * 0.7 - 0.1;
      const cz = Math.cos(x * 0.45) * 0.7;
      put(
        out,
        (s * len + l) * 3,
        x,
        cy + across * Math.cos(twist) + lift,
        cz + across * Math.sin(twist)
      );
    }
  }
};

// --- State 4: Contact. A tangled filament tree. ---------------------------------

export const TREE = { bottom: -2.9, top: 2.7 };

const tree: Builder = (out, strands, len, rand) => {
  const height = TREE.top - TREE.bottom;

  for (let s = 0; s < strands; s++) {
    const t = fract(s * PHI); // 0 at the foot, 1 at the tip
    const y0 = TREE.bottom + t * height;
    const phase = rand() * TAU;
    // Lower branches reach further, so the silhouette tapers upward.
    const reach = (0.25 + (1 - t) * 1.55) * (0.45 + rand() * 0.75);
    const rise = 0.35 + rand() * 0.75;
    const kink = 2 + rand() * 4;
    const wobble = 0.1 + rand() * 0.22;
    const swirl = (rand() - 0.5) * 2.4;

    for (let l = 0; l < len; l++) {
      const u = l / (len - 1);
      // Out from the trunk fast, then drifting: a filament, not a spoke.
      const out2 = reach * Math.pow(u, 0.72);
      const a = phase + u * swirl;
      const tangle = wobble * u;
      put(
        out,
        (s * len + l) * 3,
        Math.cos(a) * out2 + Math.sin(u * kink * TAU * 0.5 + phase) * tangle,
        y0 + u * rise + Math.cos(u * kink * TAU * 0.37 + phase * 2) * tangle,
        Math.sin(a) * out2 + Math.cos(u * kink * TAU * 0.43 + phase) * tangle
      );
    }
  }
};

// --- State 5: the end of the page. Everything resolves to one line. -------------

const line: Builder = (out, strands, len) => {
  const height = TREE.top - TREE.bottom;
  for (let s = 0; s < strands; s++) {
    const y0 = TREE.bottom + fract(s * PHI) * height;
    for (let l = 0; l < len; l++) {
      put(out, (s * len + l) * 3, 0, y0 + (l / (len - 1)) * 0.5, 0);
    }
  }
};

const BUILDERS: ReadonlyArray<Builder> = [gyroscope, vase, column, ribbon, tree, line];

export const STATE_COUNT = BUILDERS.length;

/**
 * One Float32Array of xyz targets per state. Each builder gets its own seeded
 * PRNG, so editing one state never disturbs the others.
 */
export function buildStates(strands: number, pointsPerStrand: number): Float32Array[] {
  return BUILDERS.map((build, index) => {
    const arr = new Float32Array(strands * pointsPerStrand * 3);
    build(arr, strands, pointsPerStrand, mulberry32(0x9e37 + index * 7919));
    return arr;
  });
}

/**
 * Per-point metadata: (seed, position along the strand, band, role).
 * The seed is constant within a strand, so a strand morphs as one thread.
 */
export function buildMeta(strands: number, pointsPerStrand: number): Float32Array {
  const rand = mulberry32(0xc0ffee);
  const meta = new Float32Array(strands * pointsPerStrand * 4);
  for (let s = 0; s < strands; s++) {
    const seed = rand();
    for (let l = 0; l < pointsPerStrand; l++) {
      const i = (s * pointsPerStrand + l) * 4;
      meta[i] = seed;
      meta[i + 1] = l / (pointsPerStrand - 1);
      meta[i + 2] = bandOf(s);
      meta[i + 3] = roleOf(s);
    }
  }
  return meta;
}

/**
 * Index pairs joining consecutive points within each strand. Strands never
 * link to each other, so no segment can streak across the scene mid-morph.
 */
export function buildSegmentIndices(strands: number, pointsPerStrand: number): Uint16Array | Uint32Array {
  const segments = strands * (pointsPerStrand - 1);
  const idx = strands * pointsPerStrand > 65535 ? new Uint32Array(segments * 2) : new Uint16Array(segments * 2);
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
