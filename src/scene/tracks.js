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

// Weight of the vertical fit for the Work hoop stack (1 = the whole stack of
// project hoops must stay on screen). Only Work has a stack.
export const FIT_HEIGHT = [0, 1, 0, 0, 0];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Sample a per-state track at a fractional progress value. */
export function sampleTrack(track, progress) {
  const p = clamp(progress, 0, track.length - 1);
  const i = Math.floor(p);
  const j = Math.min(i + 1, track.length - 1);
  return track[i] + (track[j] - track[i]) * (p - i);
}

/**
 * Camera distance that keeps a stack `halfHeight` tall (about its centre) in
 * view, measured at the stack's nearest face (`depth` in front of centre) and
 * allowing for the camera sitting `camY` above it. The 0.9 leaves headroom for
 * the group's tilt and drift. Never closer than `baseZ`.
 */
export function fitCameraZHeight(baseZ, halfHeight, depth, camY, fovDeg) {
  if (!(halfHeight > 0)) return baseZ;
  const halfTan = Math.tan((fovDeg * Math.PI) / 360);
  return Math.max(baseZ, (halfHeight + Math.abs(camY)) / (halfTan * 0.9) + depth);
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
