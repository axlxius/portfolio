import gsap from 'gsap';

import { finePointer, qsa } from '../core/env.ts';
import { motion } from '../core/motion.ts';

const PULL = 0.32; // how far the element leans, as a fraction of the offset
const REACH = 28; // px beyond the element's edge where the pull starts

/**
 * Magnetic elements lean toward the pointer while it is near, and spring back
 * when it leaves. Also publishes the pointer position inside the element as
 * --mx / --my, which the contact buttons use as the origin of their fill.
 */
export function createMagnetics() {
  if (!finePointer) return;

  const items = qsa('[data-magnetic]').map((node) => ({
    node,
    x: gsap.quickTo(node, 'x', { duration: 0.5, ease: 'power3.out' }),
    y: gsap.quickTo(node, 'y', { duration: 0.5, ease: 'power3.out' }),
    active: false,
  }));

  window.addEventListener(
    'pointermove',
    (event) => {
      for (const item of items) {
        const r = item.node.getBoundingClientRect();
        // The rect includes the current lean, so remove it to get the rest box.
        const tx = Number(gsap.getProperty(item.node, 'x')) || 0;
        const ty = Number(gsap.getProperty(item.node, 'y')) || 0;
        const cx = r.left - tx + r.width / 2;
        const cy = r.top - ty + r.height / 2;
        const dx = event.clientX - cx;
        const dy = event.clientY - cy;
        const inside = Math.abs(dx) < r.width / 2 + REACH && Math.abs(dy) < r.height / 2 + REACH;

        if (inside && !motion.reduced) {
          item.active = true;
          item.x(dx * PULL);
          item.y(dy * PULL);
          item.node.style.setProperty('--mx', `${((event.clientX - r.left) / r.width) * 100}%`);
          item.node.style.setProperty('--my', `${((event.clientY - r.top) / r.height) * 100}%`);
        } else if (item.active) {
          item.active = false;
          gsap.to(item.node, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.45)', overwrite: true });
        }
      }
    },
    { passive: true }
  );
}
