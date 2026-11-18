import gsap from 'gsap';

import { finePointer, qsa } from '../core/env.ts';
import { motion } from '../core/motion.ts';

const SHAPES = ['square', 'circle', 'bar'] as const;
const TONES = ['--accent', '--second', '--card', '--ink', '--cell'];

/** A handful of chunky shapes thrown out from a point. */
export function burst(x: number, y: number, count = 9, spread = 1) {
  if (motion.reduced) return;
  const style = getComputedStyle(document.documentElement);
  for (let i = 0; i < count; i++) {
    const bit = document.createElement('span');
    bit.className = 'burst-bit';
    bit.dataset.shape = SHAPES[i % SHAPES.length];
    bit.style.background = style.getPropertyValue(TONES[i % TONES.length]);
    document.body.append(bit);
    const angle = (i / count) * Math.PI * 2 + gsap.utils.random(-0.3, 0.3);
    const dist = gsap.utils.random(70, 150) * spread;
    gsap.set(bit, { x: x - 9, y: y - 9, rotate: gsap.utils.random(0, 90), scale: 0.4 });
    gsap
      .timeline({ onComplete: () => bit.remove() })
      .to(bit, {
        x: x - 9 + Math.cos(angle) * dist,
        y: y - 9 + Math.sin(angle) * dist,
        rotate: `+=${gsap.utils.random(-220, 220)}`,
        scale: 1,
        duration: 0.55,
        ease: 'power3.out',
      })
      .to(bit, { scale: 0, duration: 0.25, ease: 'back.in(2)' }, '>-0.1');
  }
}

/**
 * Pointer play on the page:
 *
 *  - a project slab leans toward the pointer while it is over it;
 *  - clicking a slab, or any chunky button, throws a burst of shapes. A slab
 *    that leads to another page waits a beat, so the burst is seen.
 */
export function createTouch() {
  if (finePointer) {
    qsa('.slab').forEach((slab) => {
      slab.addEventListener('pointermove', (event) => {
        if (motion.reduced) return;
        const r = slab.getBoundingClientRect();
        const lx = ((event.clientX - r.left) / r.width) * 2 - 1;
        const ly = ((event.clientY - r.top) / r.height) * 2 - 1;
        slab.style.setProperty('--lx', lx.toFixed(3));
        slab.style.setProperty('--ly', ly.toFixed(3));
      });
      slab.addEventListener('pointerleave', () => {
        slab.style.removeProperty('--lx');
        slab.style.removeProperty('--ly');
      });
    });
  }

  document.addEventListener('click', (event) => {
    const target = event.target as Element | null;
    const hit = target?.closest('.block, .slab.is-linked, .wordmark');
    if (!hit) return;
    // A keyboard "click" has no position: burst from the middle of the thing.
    const r = hit.getBoundingClientRect();
    const x = event.clientX || r.left + r.width / 2;
    const y = event.clientY || r.top + r.height / 2;
    burst(x, y);

    const link = target?.closest<HTMLAnchorElement>('.slab-link');
    const plain = !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0;
    if (link && plain && !motion.reduced && !event.defaultPrevented) {
      event.preventDefault();
      window.setTimeout(() => {
        window.location.href = link.href;
      }, 320);
    }
  });
}
