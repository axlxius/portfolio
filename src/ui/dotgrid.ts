import { damp, qs } from '../core/env.ts';
import { motion } from '../core/motion.ts';

const SPACING = 18; // CSS px between dots
const REACH = 110; // px around the pointer that the grid bends away from
const PUSH = 16; // how far a dot is pushed at the pointer itself

/**
 * A patch of fine dots in the top-right corner. Their brightness breathes in
 * a slow ripple from the corner, and the grid bends away from the pointer
 * when it passes over. Plain 2D canvas: it does not depend on WebGL, so it
 * stays when the 3D scene cannot start.
 */
export function createDotGrid() {
  const canvas = qs<HTMLCanvasElement>('[data-dotgrid]');
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) return null;

  let size = 0;
  let dpr = 1;
  let ink = '0,0,0';
  let elapsed = 0;
  let lift = 0;
  let liftTarget = 0;
  const pointer = { x: -999, y: -999 };
  let dirty = true;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    size = canvas!.clientWidth;
    canvas!.width = Math.round(size * dpr);
    canvas!.height = Math.round(size * dpr);
    dirty = true;
  }

  function readInk() {
    const match = getComputedStyle(document.documentElement).getPropertyValue('--fg-rgb').match(/\d+/g);
    if (match) ink = match.join(',');
    dirty = true;
  }

  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType !== 'mouse') return;
      // Pointer position in the canvas's own coordinates (it is pinned top-right).
      pointer.x = event.clientX - (window.innerWidth - size);
      pointer.y = event.clientY;
    },
    { passive: true }
  );
  resize();
  readInk();

  return {
    /** Re-read the ink colour after a theme change. */
    refresh: readInk,
    /** A small lift in brightness, e.g. while a project is active. */
    setLift(on: boolean) {
      liftTarget = on ? 1 : 0;
    },
    update(dt: number) {
      if (size === 0 || document.hidden) return;
      const still = motion.reduced;
      if (still && !dirty) return;
      dirty = false;
      if (!still) elapsed += dt;
      lift += (liftTarget - lift) * damp(6, dt);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      const n = Math.ceil(size / SPACING);

      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          // Measured from the top-right corner.
          let x = size - (c + 0.5) * SPACING;
          let y = (r + 0.5) * SPACING;
          const d = Math.hypot(c + 0.5, r + 0.5) * SPACING;

          // Soft quarter-circle mask so the patch dissolves into the page.
          const mask = Math.max(0, 1 - d / size) ** 1.6;
          if (mask < 0.01) continue;

          let bend = 0;
          if (!still) {
            const dx = x - pointer.x;
            const dy = y - pointer.y;
            const dist = Math.hypot(dx, dy);
            if (dist < REACH) {
              bend = (1 - dist / REACH) ** 2;
              x += (dx / (dist || 1)) * bend * PUSH;
              y += (dy / (dist || 1)) * bend * PUSH;
            }
          }

          const pulse = (0.5 + 0.5 * Math.sin(elapsed * 1.5 - d * 0.03)) ** 3;
          const a = mask * (0.16 + 0.4 * pulse + 0.15 * lift) + bend * 0.5;
          const s = 1.4 + pulse * 1.1 * mask + bend * 1.2;
          ctx.fillStyle = `rgba(${ink},${Math.min(a, 0.9)})`;
          ctx.fillRect(x - s / 2, y - s / 2, s, s);
        }
      }
    },
  };
}
