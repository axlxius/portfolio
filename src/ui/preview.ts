import gsap from 'gsap';

import type { Project } from '../data/content.ts';
import { clamp, el } from '../core/env.ts';
import { motion } from '../core/motion.ts';
import { createVisualRunner } from '../visuals/index.ts';

const OFFSET = 26; // gap between the pointer and the card's near corner
const STIFFNESS = 150;
const DAMPING = 20;

/**
 * The card that follows the pointer over the work list, showing the hovered
 * project's visual. It trails the pointer on a spring, so it lags, overshoots
 * a touch and leans into fast moves.
 */
export function createPreview() {
  const root = el('div', 'preview', { 'aria-hidden': 'true' });
  const card = el('div', 'preview-card');
  const canvas = el('canvas', 'preview-canvas');
  const caption = el('div', 'preview-caption');
  const index = el('span', 'mono');
  const title = el('span', 'mono');
  caption.append(index, title);
  card.append(canvas, caption);
  root.append(card);
  document.body.append(root);

  const runner = createVisualRunner(canvas);
  const pointer = { x: 0, y: 0 };
  const pos = { x: 0, y: 0, vx: 0, vy: 0 };
  let open = false;
  let placed = false;

  window.addEventListener(
    'pointermove',
    (event) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
    },
    { passive: true }
  );

  const tick = (_time: number, deltaMs: number) => {
    const dt = Math.min(deltaMs / 1000, 0.04);
    const w = root.offsetWidth;
    const h = root.offsetHeight;
    // Sit below-right of the pointer, flipping sides near the viewport edges.
    const tx = pointer.x + OFFSET + w > window.innerWidth - 12 ? pointer.x - OFFSET - w : pointer.x + OFFSET;
    const ty = clamp(pointer.y + OFFSET, 12, window.innerHeight - h - 12);

    if (!placed || motion.reduced) {
      pos.x = tx;
      pos.y = ty;
      pos.vx = pos.vy = 0;
      placed = true;
    } else {
      pos.vx += ((tx - pos.x) * STIFFNESS - pos.vx * DAMPING) * dt;
      pos.vy += ((ty - pos.y) * STIFFNESS - pos.vy * DAMPING) * dt;
      pos.x += pos.vx * dt;
      pos.y += pos.vy * dt;
    }
    const lean = clamp(pos.vx * 0.006, -7, 7);
    root.style.transform = `translate3d(${pos.x.toFixed(1)}px, ${pos.y.toFixed(1)}px, 0) rotate(${lean.toFixed(2)}deg)`;
  };

  return {
    show(project: Project, order: number) {
      index.textContent = String(order + 1).padStart(2, '0');
      title.textContent = project.title;
      runner.set(project.visual);
      if (open) return;
      open = true;
      placed = false;
      root.classList.add('is-open');
      runner.start();
      gsap.ticker.add(tick);
    },
    hide() {
      if (!open) return;
      open = false;
      root.classList.remove('is-open');
      // Keep drawing and following until the card has closed.
      gsap.delayedCall(0.5, () => {
        if (open) return;
        runner.stop();
        gsap.ticker.remove(tick);
      });
    },
    refresh: () => runner.refresh(),
  };
}

export type Preview = ReturnType<typeof createPreview>;
