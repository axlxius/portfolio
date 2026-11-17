/**
 * Generative visuals, one per project.
 *
 * These are drawings of each project's idea, not screenshots of the product:
 * no real data, no real UI, nothing that could be mistaken for a result. Each
 * is a pure function of time, so the small preview card and the large overlay
 * panel can both draw the same visual without sharing any state.
 */
import gsap from 'gsap';

import type { VisualId } from '../data/content.ts';
import { motion } from '../core/motion.ts';

export interface Paint {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  /** Seconds since the visual was shown. */
  t: number;
  /** One hundredth of the shorter side: the visual's unit of length. */
  u: number;
  /** Ink at a given strength, as a CSS colour. */
  ink: (alpha?: number) => string;
}

type Visual = (p: Paint) => void;

const TAU = Math.PI * 2;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** Progress of t through the window [a, b], clamped. */
const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const ease = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
const easeIo = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const hash = (n: number) => {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
};

function label(p: Paint, text: string, x: number, y: number, alpha = 0.6, align: CanvasTextAlign = 'left', size = 3.1) {
  const { ctx, u } = p;
  ctx.font = `${Math.max(8, size * u)}px "Martian Mono", ui-monospace, monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = p.ink(alpha);
  ctx.fillText(text.toUpperCase().split('').join(' '), x, y);
}

function hairline(p: Paint, x1: number, y1: number, x2: number, y2: number, alpha = 0.25) {
  const { ctx } = p;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = p.ink(alpha);
  ctx.lineWidth = 1;
  ctx.stroke();
}

// --- This Site: a miniature of the morphing cloud ------------------------------

const MINI = 420;
const MINI_SHAPES: Float32Array[] = (() => {
  const shapes = [new Float32Array(MINI * 3), new Float32Array(MINI * 3), new Float32Array(MINI * 3)];
  for (let i = 0; i < MINI; i++) {
    const f = i / MINI;
    const a = hash(i + 1) * TAU;
    // Rings: three tilted orbits.
    const ring = i % 3;
    const r = 0.95 - ring * 0.24;
    const tilt = [0.3, 1.25, -0.8][ring];
    const y0 = Math.sin(a) * r * Math.sin(tilt);
    shapes[0].set([Math.cos(a) * r, y0, Math.sin(a) * r * Math.cos(tilt)], i * 3);
    // Vase: stacked rings on a profile.
    const row = Math.floor(f * 18) / 17;
    const vr = 0.3 + 0.5 * Math.pow(Math.sin(Math.PI * Math.pow(row, 0.8)), 1.2) + (row > 0.92 ? 0.12 : 0);
    shapes[1].set([Math.cos(a) * vr, 0.95 - row * 1.9, Math.sin(a) * vr], i * 3);
    // Column: stacked ellipses.
    const level = Math.floor(f * 14) / 13;
    shapes[2].set([Math.cos(a) * 0.42, 1.05 - level * 2.1 + Math.sin(a + level * 9) * 0.07, Math.sin(a) * 0.42], i * 3);
  }
  return shapes;
})();

const site: Visual = (p) => {
  const { ctx, w, h, t, u } = p;
  const cycle = 2.6;
  const phase = t / cycle;
  const from = MINI_SHAPES[Math.floor(phase) % 3];
  const to = MINI_SHAPES[(Math.floor(phase) + 1) % 3];
  const turn = t * 0.5;
  const cos = Math.cos(turn), sin = Math.sin(turn);
  const scale = Math.min(w, h) * 0.36;

  for (let i = 0; i < MINI; i++) {
    // Each point leaves a little early or late, like the real thing.
    const k = easeIo(clamp01(span(phase % 1, 0.45, 1) * 1.4 - hash(i * 3.7) * 0.4));
    const x0 = from[i * 3] + (to[i * 3] - from[i * 3]) * k;
    const y0 = from[i * 3 + 1] + (to[i * 3 + 1] - from[i * 3 + 1]) * k;
    const z0 = from[i * 3 + 2] + (to[i * 3 + 2] - from[i * 3 + 2]) * k;
    const x = x0 * cos + z0 * sin;
    const z = z0 * cos - x0 * sin;
    const depth = 1 / (1 + z * 0.28);
    ctx.fillStyle = p.ink(0.3 + 0.6 * clamp01(0.5 - z * 0.5));
    const s = Math.max(1, u * 0.75 * depth);
    ctx.fillRect(w / 2 + x * scale * depth - s / 2, h / 2 - y0 * scale * depth - s / 2, s, s);
  }
  label(p, ['Orbit', 'Vase', 'Column'][(Math.floor(phase) + (phase % 1 > 0.7 ? 1 : 0)) % 3], 6 * u, h - 6 * u, 0.55);
};

// --- Portfolio Dashboard: a line that keeps ticking -----------------------------

// The four sleeves of the book, as named in the write-up. No values are shown.
const SLEEVES = ['ETF', 'SGX', 'REIT', 'US'];

const dashboard: Visual = (p) => {
  const { ctx, w, h, t, u } = p;
  const pad = 7 * u;
  const tape = Math.max(18 * u, w * 0.2);
  const left = pad + tape;
  const right = w - pad;
  const top = pad + 3 * u;
  const bottom = h - pad - 4 * u;

  // Ticks arrive twice a second; the line is a walk built from a few sines.
  const tick = Math.floor(t * 2);
  const walk = (x: number) =>
    Math.sin(x * 0.9) * 0.34 + Math.sin(x * 2.3 + 1.7) * 0.2 + Math.sin(x * 5.1 + 0.4) * 0.1 + x * 0.035;
  const steps = 44;
  const head = t * 1.3;

  for (let i = 0; i <= 3; i++) {
    const y = top + ((bottom - top) * i) / 3;
    hairline(p, left, y, right, y, 0.14);
  }

  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const x = left + ((right - left) * i) / steps;
    const v = walk(head - (steps - i) * 0.11);
    const y = (top + bottom) / 2 - (v - walk(head) * 0.6) * (bottom - top) * 0.55;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = p.ink(1);
  ctx.lineWidth = Math.max(1.25, u * 0.45);
  ctx.lineJoin = 'round';
  ctx.stroke();

  // The live point, with a ring that pulses on each tick.
  const hy = (top + bottom) / 2 - walk(head) * 0.4 * (bottom - top) * 0.55;
  const pulse = (t * 2) % 1;
  ctx.beginPath();
  ctx.arc(right, hy, u * 1.1, 0, TAU);
  ctx.fillStyle = p.ink(1);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(right, hy, u * (1.1 + pulse * 4.5), 0, TAU);
  ctx.strokeStyle = p.ink(0.6 * (1 - pulse));
  ctx.lineWidth = 1;
  ctx.stroke();

  // Tape: each sleeve gets a meter and an arrow that flips with its ticks.
  SLEEVES.forEach((name, i) => {
    const y = top + ((bottom - top) * (i + 0.5)) / SLEEVES.length;
    const level = 0.35 + 0.6 * hash(i * 17.3 + Math.floor((tick + i) / 2));
    const up = hash(i * 5.1 + tick) > 0.45;
    label(p, name, pad, y - 1.6 * u, 0.9);
    ctx.fillStyle = p.ink(0.22);
    ctx.fillRect(pad, y + 1.6 * u, tape - 6 * u, Math.max(1, u * 0.5));
    ctx.fillStyle = p.ink(0.95);
    ctx.fillRect(pad, y + 1.6 * u, (tape - 6 * u) * level, Math.max(1, u * 0.5));
    ctx.beginPath();
    const ax = pad + tape - 4 * u;
    const dir = up ? -1 : 1;
    ctx.moveTo(ax, y - 1.6 * u + dir * 1.1 * u);
    ctx.lineTo(ax - 1.1 * u, y - 1.6 * u - dir * 0.8 * u);
    ctx.lineTo(ax + 1.1 * u, y - 1.6 * u - dir * 0.8 * u);
    ctx.closePath();
    ctx.fillStyle = p.ink(up ? 1 : 0.5);
    ctx.fill();
  });
  label(p, 'Live', right, h - pad, 0.55 + 0.35 * (1 - pulse), 'right');
};

// --- SCI Copilot: a question, a check, a flagged drift --------------------------

function bubble(p: Paint, x: number, y: number, w: number, h: number, k: number, filled: boolean) {
  const { ctx, u } = p;
  if (k <= 0) return;
  ctx.save();
  ctx.globalAlpha = k;
  ctx.translate(0, (1 - k) * 2 * u);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 1.6 * u);
  if (filled) {
    ctx.fillStyle = p.ink(1);
    ctx.fill();
  } else {
    ctx.strokeStyle = p.ink(0.55);
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}

const copilot: Visual = (p) => {
  const { ctx, w, h, u } = p;
  const t = p.t % 7.5;
  const fade = 1 - span(t, 7, 7.5);
  const pad = 7 * u;
  const split = w * 0.52;
  ctx.save();
  ctx.globalAlpha = fade;

  // Left: the conversation.
  const bw = split - pad * 1.6;
  bubble(p, pad + bw * 0.3, pad, bw * 0.7, 9 * u, ease(span(t, 0.2, 0.7)), true);
  const typing = span(t, 0.9, 1.2) * (1 - span(t, 2.3, 2.5));
  if (typing > 0) {
    bubble(p, pad, pad + 13 * u, 15 * u, 8 * u, typing, false);
    for (let i = 0; i < 3; i++) {
      const hop = Math.max(0, Math.sin(t * 7 - i * 0.9)) * 1.4 * u;
      ctx.beginPath();
      ctx.arc(pad + (4 + i * 3.5) * u, pad + 17 * u - hop, 0.8 * u, 0, TAU);
      ctx.fillStyle = p.ink(0.85 * typing);
      ctx.fill();
    }
  }
  const answer = ease(span(t, 2.4, 2.9));
  bubble(p, pad, pad + 13 * u, bw * 0.86, 21 * u, answer, false);
  for (let i = 0; i < 4; i++) {
    const k = ease(span(t, 2.7 + i * 0.22, 3.1 + i * 0.22));
    ctx.fillStyle = p.ink(0.6);
    ctx.fillRect(pad + 3 * u, pad + (17.5 + i * 4.2) * u, (bw * 0.86 - 6 * u) * [1, 0.92, 0.97, 0.5][i] * k, Math.max(1, 0.7 * u));
  }

  // The compliance check: a ring that closes and a tick that draws.
  const check = span(t, 3.7, 4.4);
  if (check > 0) {
    const cx = pad + 3.2 * u, cy = pad + 41 * u;
    ctx.beginPath();
    ctx.arc(cx, cy, 2.6 * u, -Math.PI / 2, -Math.PI / 2 + TAU * ease(check));
    ctx.strokeStyle = p.ink(1);
    ctx.lineWidth = Math.max(1, 0.4 * u);
    ctx.stroke();
    const tick = ease(span(t, 4.1, 4.5));
    ctx.beginPath();
    ctx.moveTo(cx - 1.2 * u, cy);
    ctx.lineTo(cx - 1.2 * u + 0.9 * u * Math.min(1, tick * 2), cy + 0.9 * u * Math.min(1, tick * 2));
    if (tick > 0.5) ctx.lineTo(cx - 0.3 * u + 1.7 * u * (tick - 0.5) * 2, cy + 0.9 * u - 2 * u * (tick - 0.5) * 2);
    ctx.stroke();
    label(p, 'Disclosure check', cx + 5 * u, cy, 0.85 * ease(check));
  }

  // Right: two versions of a document. One line has drifted.
  const doc = ease(span(t, 4.6, 5.2));
  if (doc > 0) {
    const dx = split + pad * 0.4;
    const dw = (w - pad - dx - 3 * u) / 2;
    ['V1', 'V2'].forEach((name, c) => {
      const x = dx + c * (dw + 3 * u);
      ctx.globalAlpha = fade * doc;
      ctx.strokeStyle = p.ink(0.4);
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, pad + 0.5, dw, h - pad * 2);
      label(p, name, x + 2.5 * u, pad + 4 * u, 0.7);
      for (let i = 0; i < 9; i++) {
        const y = pad + (9 + i * 4.4) * u;
        if (y > h - pad - 3 * u) break;
        const drifted = c === 1 && i === 4;
        const lw = (dw - 5 * u) * (0.55 + hash(i * 3.3) * 0.45);
        if (drifted) {
          const flag = ease(span(t, 5.5, 6.0));
          ctx.fillStyle = p.ink(flag);
          ctx.fillRect(x + 1.5 * u, y - 1.6 * u, dw - 3 * u, 3.4 * u);
          ctx.globalCompositeOperation = 'destination-out';
          ctx.fillStyle = `rgba(0,0,0,${flag})`;
          ctx.fillRect(x + 2.5 * u, y - 0.2 * u, lw * 0.7, Math.max(1, 0.7 * u));
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = p.ink(0.55 * (1 - flag));
          ctx.fillRect(x + 2.5 * u, y - 0.2 * u, lw * 0.7, Math.max(1, 0.7 * u));
        } else {
          ctx.fillStyle = p.ink(0.5);
          ctx.fillRect(x + 2.5 * u, y - 0.2 * u, lw, Math.max(1, 0.7 * u));
        }
      }
    });
    ctx.globalAlpha = fade;
    label(p, 'Drift', w - pad, h - pad * 0.45, ease(span(t, 5.8, 6.2)), 'right');
  }
  ctx.restore();
};

// --- GrowcerySG: a plant grows as the footprint falls ---------------------------

const growcery: Visual = (p) => {
  const { ctx, w, h, u } = p;
  const t = p.t % 7.5;
  const grow = easeIo(span(t, 0.2, 4.6));
  const fade = 1 - span(t, 6.9, 7.5);
  const baseX = w * 0.44, baseY = h - 9 * u;
  const height = h - 26 * u;

  ctx.save();
  ctx.globalAlpha = fade;
  hairline(p, baseX - 22 * u, baseY, baseX + 22 * u, baseY, 0.4);

  // Stem: a gentle S, drawn up to the current growth.
  const stem = (k: number): [number, number] => [baseX + Math.sin(k * 3.1) * 3.2 * u, baseY - k * height];
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const [x, y] = stem((i / 40) * grow);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = p.ink(1);
  ctx.lineWidth = Math.max(1.25, 0.5 * u);
  ctx.lineCap = 'round';
  ctx.stroke();

  // Leaves unfurl in turn, alternating sides, each with a midrib and veins.
  const leaves = 6;
  for (let i = 0; i < leaves; i++) {
    const at = 0.18 + (i / leaves) * 0.72;
    const open = ease(span(grow, at, at + 0.2));
    if (open <= 0) continue;
    const [x, y] = stem(at);
    const side = i % 2 === 0 ? 1 : -1;
    const length = (17 - i * 1.5) * u * open;
    const angle = -0.55 - i * 0.04;
    const tipX = x + Math.cos(angle) * length * side;
    const tipY = y + Math.sin(angle) * length;
    const nx = -Math.sin(angle) * side, ny = Math.cos(angle);
    const belly = length * 0.3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo((x + tipX) / 2 + nx * belly, (y + tipY) / 2 + ny * belly, tipX, tipY);
    ctx.quadraticCurveTo((x + tipX) / 2 - nx * belly, (y + tipY) / 2 - ny * belly, x, y);
    ctx.strokeStyle = p.ink(0.95);
    ctx.lineWidth = 1;
    ctx.stroke();
    hairline(p, x, y, tipX, tipY, 0.5);
    for (let v = 1; v <= 3; v++) {
      const k = v / 4;
      const mx = x + (tipX - x) * k, my = y + (tipY - y) * k;
      const reach = belly * 0.42 * Math.sin(Math.PI * k);
      hairline(p, mx, my, mx + nx * reach + (tipX - x) * 0.08, my + ny * reach + (tipY - y) * 0.08, 0.35);
      hairline(p, mx, my, mx - nx * reach + (tipX - x) * 0.08, my - ny * reach + (tipY - y) * 0.08, 0.35);
    }
  }

  // The footprint, as an index falling from 100. An illustration, not a result.
  const index = Math.round(100 - 38 * grow);
  label(p, 'Carbon index', w - 7 * u, 8 * u, 0.6, 'right');
  ctx.font = `200 ${14 * u}px "Anybody", sans-serif`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillStyle = p.ink(1);
  ctx.fillText(String(index), w - 7 * u, 11 * u);
  ctx.restore();
};

// --- Housing and Fertility: one line rises, the other falls ---------------------

const housing: Visual = (p) => {
  const { ctx, w, h, u } = p;
  const t = p.t % 7;
  const draw = easeIo(span(t, 0.3, 3.4));
  const fade = 1 - span(t, 6.4, 7);
  const left = 9 * u, right = w - 9 * u, top = 10 * u, bottom = h - 11 * u;

  ctx.save();
  ctx.globalAlpha = fade;
  hairline(p, left, top - 3 * u, left, bottom, 0.5);
  hairline(p, left, bottom, right, bottom, 0.5);
  for (let i = 1; i <= 5; i++) {
    const x = left + ((right - left) * i) / 5;
    hairline(p, x, bottom, x, bottom + 1.5 * u, 0.5);
    hairline(p, x, top, x, bottom, 0.08);
  }

  const rise = (k: number) => bottom - (0.12 + 0.78 * Math.pow(k, 1.6)) * (bottom - top) - Math.sin(k * 14) * 0.6 * u;
  const fall = (k: number) => top + (0.1 + 0.68 * (1 - Math.pow(1 - k, 2))) * (bottom - top) + Math.sin(k * 11 + 1) * 0.8 * u;
  const lines: Array<[(k: number) => number, string, number[]]> = [
    [rise, 'Resale price', []],
    [fall, 'Fertility rate', [1.4 * u, 1.4 * u]],
  ];
  for (const [f, name, dash] of lines) {
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const k = (i / 60) * draw;
      const x = left + (right - left) * k;
      if (i === 0) ctx.moveTo(x, f(k));
      else ctx.lineTo(x, f(k));
    }
    ctx.setLineDash(dash);
    ctx.strokeStyle = p.ink(1);
    ctx.lineWidth = Math.max(1.25, 0.5 * u);
    ctx.stroke();
    ctx.setLineDash([]);
    const x = left + (right - left) * draw;
    ctx.beginPath();
    ctx.arc(x, f(draw), 1.1 * u, 0, TAU);
    ctx.fillStyle = p.ink(1);
    ctx.fill();
    const named = ease(span(t, 3.3, 3.9));
    label(p, name, right, f(1) + (f === rise ? -4 : 4.5) * u, 0.75 * named, 'right');
  }
  ctx.restore();
};

// --- pay2live: slots fill, a one-time code arrives ------------------------------

const BOOKINGS = [9, 3, 17, 12, 26, 20];

const clinic: Visual = (p) => {
  const { ctx, w, h, u } = p;
  const t = p.t % 7.5;
  const loop = Math.floor(p.t / 7.5);
  const fade = 1 - span(t, 6.9, 7.5);
  const pad = 8 * u;
  const cols = 7, rows = 5;
  const gw = Math.min(w - pad * 2, (h - pad * 2 - 6 * u) * 1.5);
  const cell = gw / cols;
  const gx = pad, gy = pad + 6 * u;

  ctx.save();
  ctx.globalAlpha = fade;
  'MTWTFSS'.split('').forEach((d, c) => label(p, d, gx + (c + 0.5) * cell, pad + 1.5 * u, 0.55, 'center'));
  for (let c = 0; c <= cols; c++) hairline(p, gx + c * cell, gy, gx + c * cell, gy + rows * cell * 0.72, 0.25);
  for (let r = 0; r <= rows; r++) hairline(p, gx, gy + r * cell * 0.72, gx + gw, gy + r * cell * 0.72, 0.25);

  BOOKINGS.forEach((slot, i) => {
    const k = ease(span(t, 0.4 + i * 0.45, 0.8 + i * 0.45));
    if (k <= 0) return;
    const c = slot % cols, r = Math.floor(slot / cols);
    const ch = cell * 0.72;
    const inset = 1.1 * u + (1 - k) * cell * 0.3;
    ctx.fillStyle = p.ink(i === BOOKINGS.length - 1 ? k : 0.22 * k);
    ctx.fillRect(gx + c * cell + inset, gy + r * ch + inset, cell - inset * 2, ch - inset * 2);
  });

  // The code: a speech bubble that pops in, then six digits, one at a time.
  const pop = ease(span(t, 3.4, 3.8));
  if (pop > 0) {
    const bw = Math.min(44 * u, w * 0.5), bh = 15 * u;
    const bx = w - pad - bw, by = h - pad - bh;
    ctx.save();
    ctx.translate(bx + bw, by + bh);
    ctx.scale(0.8 + 0.2 * pop, 0.8 + 0.2 * pop);
    ctx.globalAlpha = fade * pop;
    ctx.beginPath();
    ctx.roundRect(-bw, -bh, bw, bh, 2 * u);
    ctx.fillStyle = p.ink(1);
    ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000';
    ctx.font = `${Math.max(8, 2.9 * u)}px "Martian Mono", ui-monospace, monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('O T P', -bw + 3 * u, -bh + 4 * u);
    ctx.font = `${5.4 * u}px "Martian Mono", ui-monospace, monospace`;
    for (let i = 0; i < 6; i++) {
      const shown = t > 4.0 + i * 0.22;
      const digit = Math.floor(hash(loop * 7.3 + i * 1.9) * 10);
      ctx.fillText(shown ? String(digit) : '·', -bw + (3 + i * 6.4) * u, -5.2 * u);
    }
    ctx.restore();
  }
  ctx.restore();
};

export const VISUALS: Record<VisualId, Visual> = { site, dashboard, copilot, growcery, housing, clinic };

/** A representative moment of each visual, shown when motion is reduced. */
const STILL: Record<VisualId, number> = { site: 1.2, dashboard: 3, copilot: 6.5, growcery: 5.5, housing: 5, clinic: 6 };

/**
 * Draws one visual into a canvas, sized to the canvas's box and its device
 * pixel ratio, in the canvas's own text colour. Runs only while started.
 */
export function createVisualRunner(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  let id: VisualId | null = null;
  let start = 0;
  let running = false;
  let rgb = '0,0,0';
  let w = 0, h = 0;

  function size() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = rect.width;
    h = rect.height;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    const match = getComputedStyle(canvas).color.match(/[\d.]+/g);
    if (match) rgb = match.slice(0, 3).join(',');
  }

  const observer = new ResizeObserver(() => {
    size();
    draw(gsap.ticker.time);
  });
  observer.observe(canvas);

  function draw(time: number) {
    if (!ctx || !id || w === 0) return;
    ctx.clearRect(0, 0, w, h);
    const t = motion.reduced ? STILL[id] : time - start;
    VISUALS[id]({ ctx, w, h, t, u: Math.min(w, h) / 100, ink: (alpha = 1) => `rgba(${rgb},${alpha})` });
  }

  const tick = (time: number) => {
    if (running && !document.hidden) draw(time);
  };

  return {
    set(next: VisualId) {
      if (next !== id) start = gsap.ticker.time;
      id = next;
      size();
      draw(gsap.ticker.time);
    },
    start() {
      if (running) return;
      running = true;
      size();
      gsap.ticker.add(tick);
    },
    stop() {
      running = false;
      gsap.ticker.remove(tick);
    },
    /** Re-read the ink colour, e.g. after a theme change. */
    refresh: size,
  };
}

export type VisualRunner = ReturnType<typeof createVisualRunner>;
