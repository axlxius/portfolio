// Per-state tuning. One value per morph state (Intro, Work, Experience,
// Stack, Contact, and the closing line), sampled at the eased scroll progress
// so every knob moves smoothly with the morph.

// Camera distance and height. Each form is framed deliberately rather than all
// at one focal length.
export const CAMERA_Z = [7.4, 7.0, 7.6, 8.2, 7.8, 7.8];
export const CAMERA_Y = [0.0, 0.25, 0.0, 0.0, 0.0, 0.0];

// Where the object sits on screen, as a fraction of the viewport: positive x
// is right, positive y is up. Reading sections push it into the open right
// third so type and particles do not fight. Fades to centre on narrow screens.
export const OFFSET_X = [0.25, 0.29, 0.29, 0.04, 0.24, 0.24];
export const OFFSET_Y = [0.13, 0.0, 0.0, -0.06, 0.0, 0.0];

// Per-point morph offset: how far the wave of re-forming spreads.
export const STAGGER = [0.5, 0.42, 0.42, 0.5, 0.5, 0.35];

// Ambient drift: calm while a text-heavy section is being read.
export const NOISE = [0.07, 0.022, 0.03, 0.05, 0.06, 0.0];

// Overall weight of the cloud. The ribbon passes behind the skills lists, so
// it is held back there.
export const WEIGHT = [1, 1, 1, 0.55, 1, 1];

// How much each state turns with the slow spin (0 = held facing the camera).
export const SPIN = [1, 1, 1, 0, 1, 1];

// Half-width (world units) that must stay inside the frame. On narrow
// screens the camera backs off until it fits. 0 = free to run off the edges.
export const FIT_WIDTH = [2.6, 1.5, 1.1, 0, 2.0, 0];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Sample a per-state track at a fractional progress value. */
export function sampleTrack(track: readonly number[], progress: number): number {
  const p = clamp(progress, 0, track.length - 1);
  const i = Math.floor(p);
  const j = Math.min(i + 1, track.length - 1);
  return track[i] + (track[j] - track[i]) * (p - i);
}

/**
 * Camera distance that keeps `fit` world units of half-width in view.
 * Never closer than `baseZ`; falls back to `baseZ` on a degenerate aspect.
 */
export function fitCameraZ(baseZ: number, fit: number, fovDeg: number, aspect: number): number {
  if (!(fit > 0)) return baseZ;
  const halfTan = Math.tan((fovDeg * Math.PI) / 360) * aspect;
  if (!(halfTan > 0)) return baseZ;
  return Math.max(baseZ, (fit * 1.08) / halfTan + fit * 0.5);
}
