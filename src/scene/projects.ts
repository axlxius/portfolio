// Takeover shapes: what the cloud briefly becomes while a project is hovered.
//
// Each is an abstract figure for the idea of the project, drawn with the same
// strands as everything else. They are built on demand and cached, and they
// face the camera: unlike the morph states they are not spun.

import type { VisualId } from '../data/content.ts';
import { mulberry32 } from './shapes.ts';

const TAU = Math.PI * 2;
const PHI = 0.6180339887498949;
const fract = (v: number) => v - Math.floor(v);

type Builder = (out: Float32Array, strands: number, len: number, rand: () => number) => void;

function put(out: Float32Array, i: number, x: number, y: number, z: number) {
  out[i] = x;
  out[i + 1] = y;
  out[i + 2] = z;
}

/** Fill one strand as a straight segment from a to b. */
function segment(
  out: Float32Array, s: number, len: number,
  ax: number, ay: number, az: number, bx: number, by: number, bz: number
) {
  for (let l = 0; l < len; l++) {
    const u = l / (len - 1);
    put(out, (s * len + l) * 3, ax + (bx - ax) * u, ay + (by - ay) * u, az + (bz - az) * u);
  }
}

// This Site: the (2,3) torus knot the first version of the site opened on.
const knot: Builder = (out, strands, len, rand) => {
  const R = 1.05, r = 0.42, p = 2, q = 3;
  for (let s = 0; s < strands; s++) {
    const t0 = rand() * TAU;
    const span = 0.5 + rand() * 0.6;
    const offRadius = 0.05 + rand() * 0.2;
    const offPhase = rand() * TAU;
    const offSpin = 2 + rand() * 4;
    for (let l = 0; l < len; l++) {
      const t = t0 + (l / (len - 1)) * span;
      const ring = R + r * Math.cos(q * t);
      const a = offPhase + t * offSpin;
      const ox = Math.cos(a) * offRadius;
      put(
        out,
        (s * len + l) * 3,
        (ring + ox) * Math.cos(p * t),
        (ring + ox) * Math.sin(p * t),
        r * Math.sin(q * t) + Math.sin(a) * offRadius
      );
    }
  }
};

// Portfolio Dashboard: a bar chart with a trend line across the tops.
const BARS = [0.5, 0.82, 0.66, 1.08, 0.94, 1.42, 1.22, 1.78, 2.2];
const chart: Builder = (out, strands, len, rand) => {
  const pitch = 0.42, width = 0.24, base = -1.3;
  const x0 = (-(BARS.length - 1) / 2) * pitch;
  for (let s = 0; s < strands; s++) {
    if (s % 7 === 0) {
      // Trend line: a polyline through the bar tops.
      const k = Math.floor(fract(s * PHI) * (BARS.length - 1));
      const dz = (rand() - 0.5) * 0.06;
      segment(
        out, s, len,
        x0 + k * pitch, base + BARS[k] + 0.22, dz,
        x0 + (k + 1) * pitch, base + BARS[k + 1] + 0.22, dz
      );
      continue;
    }
    const k = s % BARS.length;
    const x = x0 + k * pitch + (rand() - 0.5) * width;
    const z = (rand() - 0.5) * width;
    // Verticals fill the bar; every fifth strand rules its top.
    if (s % 5 === 0) {
      segment(out, s, len, x0 + k * pitch - width / 2, base + BARS[k], z, x0 + k * pitch + width / 2, base + BARS[k], z);
    } else {
      const from = rand() * 0.5 * BARS[k];
      segment(out, s, len, x, base + from, z, x, base + BARS[k], z);
    }
  }
};

// SCI Copilot: three sheets of ruled text. The last one has drifted.
const sheets: Builder = (out, strands, len, rand) => {
  const w = 1.7, h = 2.3, rows = 13;
  for (let s = 0; s < strands; s++) {
    const sheet = s % 3;
    const z = (1 - sheet) * 0.55;
    // The drift: the third version sits off the other two.
    const dx = sheet === 2 ? 0.42 : sheet * -0.1;
    const dy = sheet === 2 ? -0.3 : sheet * 0.07;
    const cx = -0.1 + dx, cy = dy;

    if (s % 8 === 3) {
      // Sheet outline.
      const side = Math.floor(rand() * 4);
      const a = side === 0 || side === 3 ? -w / 2 : w / 2;
      const b = side < 2 ? h / 2 : -h / 2;
      if (side % 2 === 0) segment(out, s, len, cx - w / 2, cy + b, z, cx + w / 2, cy + b, z);
      else segment(out, s, len, cx + a, cy - h / 2, z, cx + a, cy + h / 2, z);
      continue;
    }
    const row = Math.floor(fract(Math.floor(s / 3) * PHI) * rows);
    const y = cy + h / 2 - 0.22 - (row / (rows - 1)) * (h - 0.44);
    // Ragged right edge, like set text; one row in five is a short last line.
    const full = w - 0.36;
    const length = full * (row % 5 === 4 ? 0.45 : 0.78 + fract(row * 0.37 + sheet * 0.21) * 0.22);
    const from = cx - full / 2 + rand() * length * 0.3;
    segment(out, s, len, from, y + (rand() - 0.5) * 0.02, z, cx - full / 2 + length, y, z);
  }
};

// GrowcerySG: a sprout. A stem and two veined leaves.
const sprout: Builder = (out, strands, len, rand) => {
  const stemTop = 0.35, stemBottom = -1.9;
  const stemX = (y: number) => Math.sin((y - stemBottom) * 0.8) * 0.16;
  for (let s = 0; s < strands; s++) {
    if (s % 5 === 0) {
      // Stem: a bundle of filaments.
      const from = stemBottom + rand() * 1.4;
      const length = 0.5 + rand() * 1.0;
      const ox = (rand() - 0.5) * 0.07, oz = (rand() - 0.5) * 0.07;
      for (let l = 0; l < len; l++) {
        const y = Math.min(from + (l / (len - 1)) * length, stemTop);
        put(out, (s * len + l) * 3, stemX(y) + ox, y, oz);
      }
      continue;
    }
    // Leaves: veins fanning from the base of the leaf to its tip.
    const side = s % 2 === 0 ? 1 : -1;
    const big = side > 0 ? 1 : 0.78;
    const lengthLeaf = 1.9 * big, widthLeaf = 0.62 * big;
    const lateral = (fract(s * PHI) - 0.5) * 2; // -1..1 across the leaf
    const angle = side > 0 ? 0.62 : Math.PI - 0.5; // direction the leaf points
    const from = rand() * 0.25;
    const baseX = stemX(stemTop), baseY = stemTop;
    for (let l = 0; l < len; l++) {
      const u = from + (l / (len - 1)) * (1 - from);
      const along = u * lengthLeaf;
      // Leaf outline: widest a third of the way along, pointed at the tip.
      const half = Math.sin(Math.PI * Math.pow(u, 0.72)) * widthLeaf;
      const off = lateral * half;
      const droop = -0.28 * u * u * lengthLeaf * 0.5;
      const lx = along, ly = off;
      put(
        out,
        (s * len + l) * 3,
        baseX + lx * Math.cos(angle) - ly * Math.sin(angle) * 0.55,
        baseY + lx * Math.sin(angle) * 0.75 + ly * Math.cos(angle) * 0.55 * side + droop,
        off * 0.75 + Math.sin(u * Math.PI) * 0.25 * side
      );
    }
  }
};

// Housing and Fertility: one line rises, the other falls. They cross.
const crossing: Builder = (out, strands, len, rand) => {
  const w = 3.3;
  const rise = (t: number) => -1.25 + 2.5 * Math.pow(t, 1.7);
  const fall = (t: number) => 1.05 - 1.9 * (1 - Math.pow(1 - t, 2.2)) + Math.sin(t * 9) * 0.05;
  for (let s = 0; s < strands; s++) {
    if (s % 9 === 0) {
      // Axes.
      const z = (rand() - 0.5) * 0.04;
      if (s % 2 === 0) segment(out, s, len, -w / 2, -1.45, z, w / 2, -1.45, z);
      else segment(out, s, len, -w / 2, -1.45, z, -w / 2, 1.5, z);
      continue;
    }
    const f = s % 2 === 0 ? rise : fall;
    const depth = (fract(s * PHI) - 0.5) * 0.75;
    const span = 0.25 + rand() * 0.4;
    const t0 = rand() * (1 - span);
    for (let l = 0; l < len; l++) {
      const t = t0 + (l / (len - 1)) * span;
      put(out, (s * len + l) * 3, -w / 2 + t * w, f(t), depth);
    }
  }
};

// pay2live: a month of appointment slots, three of them booked.
const calendar: Builder = (out, strands, len, rand) => {
  const cols = 7, rows = 5, cell = 0.5;
  const w = cols * cell, h = rows * cell;
  const booked = [[1, 1], [4, 2], [5, 3]];
  for (let s = 0; s < strands; s++) {
    const z = (rand() - 0.5) * 0.05;
    if (s % 3 === 0) {
      // Hatching inside a booked slot.
      const [cx, cy] = booked[Math.floor(s / 3) % booked.length];
      const y = h / 2 - cy * cell - 0.06 - rand() * (cell - 0.12);
      segment(out, s, len, -w / 2 + cx * cell + 0.06, y, z, -w / 2 + (cx + 1) * cell - 0.06, y, z);
    } else if (s % 2 === 0) {
      const k = Math.floor(fract(s * PHI) * (rows + 1));
      const from = Math.floor(rand() * (cols - 1));
      const span = 1 + Math.floor(rand() * 2);
      const y = h / 2 - k * cell;
      segment(out, s, len, -w / 2 + from * cell, y, z, -w / 2 + Math.min(from + span, cols) * cell, y, z);
    } else {
      const k = Math.floor(fract(s * PHI) * (cols + 1));
      const from = Math.floor(rand() * (rows - 1));
      const span = 1 + Math.floor(rand() * 2);
      const x = -w / 2 + k * cell;
      segment(out, s, len, x, h / 2 - from * cell, z, x, h / 2 - Math.min(from + span, rows) * cell, z);
    }
  }
};

// The island, for the "sg" easter egg: a simplified outline of Singapore's
// main island, traced by eye. Recognisable, not survey-grade.
const ISLAND: ReadonlyArray<readonly [number, number]> = [
  [-2.3, 0.05], [-2.05, 0.45], [-1.6, 0.62], [-1.2, 0.95], [-0.75, 1.12], [-0.3, 1.2],
  [0.1, 1.05], [0.45, 1.18], [0.85, 1.02], [1.2, 0.8], [1.6, 0.62], [2.05, 0.42],
  [2.4, 0.12], [2.2, -0.25], [1.7, -0.55], [1.2, -0.78], [0.7, -0.98], [0.25, -1.12],
  [-0.2, -1.0], [-0.65, -0.82], [-1.1, -0.72], [-1.5, -0.9], [-1.95, -0.7], [-2.2, -0.35],
];
const island: Builder = (out, strands, len, rand) => {
  const n = ISLAND.length;
  const scale = 0.72;
  // Cross-island chord lengths at each height, for the hatching.
  const crossings = (y: number): number[] => {
    const xs: number[] = [];
    for (let i = 0; i < n; i++) {
      const [x1, y1] = ISLAND[i];
      const [x2, y2] = ISLAND[(i + 1) % n];
      if ((y1 > y) !== (y2 > y)) xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
    }
    return xs.sort((a, b) => a - b);
  };
  for (let s = 0; s < strands; s++) {
    const z = (rand() - 0.5) * 0.06;
    if (s % 2 === 0) {
      // Coastline.
      const i = Math.floor(fract(s * PHI) * n);
      const [x1, y1] = ISLAND[i];
      const [x2, y2] = ISLAND[(i + 1) % n];
      segment(out, s, len, x1 * scale, y1 * scale, z, x2 * scale, y2 * scale, z);
    } else {
      // Sparse horizontal hatching across the interior.
      const y = -1.05 + fract(s * PHI) * 2.15;
      const xs = crossings(y);
      if (xs.length < 2) {
        segment(out, s, len, 0, y * scale, z, 0, y * scale, z);
        continue;
      }
      const a = xs[0] + 0.08, b = xs[xs.length - 1] - 0.08;
      const span = (b - a) * (0.15 + rand() * 0.3);
      const from = a + rand() * (b - a - span);
      segment(out, s, len, from * scale, y * scale, z, (from + span) * scale, y * scale, z);
    }
  }
};

export type TakeoverId = VisualId | 'island';

const BUILDERS: Record<TakeoverId, Builder> = {
  site: knot,
  dashboard: chart,
  copilot: sheets,
  growcery: sprout,
  housing: crossing,
  clinic: calendar,
  island,
};

const cache = new Map<string, Float32Array>();

/** xyz targets for a takeover shape, built once per size and then reused. */
export function buildTakeover(id: TakeoverId, strands: number, pointsPerStrand: number): Float32Array {
  const key = `${id}:${strands}:${pointsPerStrand}`;
  let arr = cache.get(key);
  if (!arr) {
    arr = new Float32Array(strands * pointsPerStrand * 3);
    const seed = Array.from(id).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
    BUILDERS[id](arr, strands, pointsPerStrand, mulberry32(seed));
    cache.set(key, arr);
  }
  return arr;
}

export const TAKEOVER_IDS = Object.keys(BUILDERS) as TakeoverId[];
