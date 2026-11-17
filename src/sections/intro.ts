import gsap from 'gsap';

import { clamp, damp, finePointer, qs } from '../core/env.ts';
import { motion } from '../core/motion.ts';

const REST = 200; // the hairline weight the name is set in
const PEAK = 640; // the weight directly under the pointer
const SETTLE = 0.5; // below this distance from rest, stop touching the DOM

/**
 * The hero name reacts to the pointer: each letter swells in weight as the
 * pointer nears it, independently, so a heavier patch travels along the name
 * like a lens. The letters' rest positions are measured once and after every
 * resize, never per frame.
 */
export function createHeroName(chars: HTMLElement[]) {
  if (!finePointer || chars.length === 0) return null;

  const hero = qs('#intro');
  const letters = chars.map((node) => ({ node, x: 0, y: 0, weight: REST, applied: REST }));
  const pointer = { x: -9999, y: -9999, active: false };
  let radius = 200;
  let ready = false;

  let stale = true;

  function measure() {
    stale = false;
    // Measured at rest weight, in page coordinates.
    letters.forEach((l) => (l.node.style.fontWeight = ''));
    letters.forEach((l) => {
      const r = l.node.getBoundingClientRect();
      l.x = r.left + r.width / 2 + window.scrollX;
      l.y = r.top + r.height / 2 + window.scrollY;
      l.applied = REST;
    });
    radius = (chars[0]?.getBoundingClientRect().height ?? 200) * 0.95;
  }

  // Measuring is deferred to the next frame that needs it, so it never runs
  // while the intro still has the letters displaced.
  const invalidate = () => (stale = true);
  window.addEventListener('resize', invalidate, { passive: true });
  document.fonts.ready.then(invalidate);

  window.addEventListener(
    'pointermove',
    (event) => {
      pointer.x = event.pageX;
      pointer.y = event.pageY;
      pointer.active = event.pointerType === 'mouse';
    },
    { passive: true }
  );
  hero?.addEventListener('pointerleave', () => (pointer.active = false));

  gsap.ticker.add((_time, deltaMs) => {
    // Nothing to do once the name has scrolled away.
    if (window.scrollY > window.innerHeight || !ready) return;
    const k = damp(9, Math.min(deltaMs / 1000, 0.05));
    const live = pointer.active && !motion.reduced;
    if (live && stale) measure();

    for (const l of letters) {
      let target = REST;
      if (live) {
        const d = Math.hypot(pointer.x - l.x, pointer.y - l.y);
        const near = clamp(1 - d / radius, 0, 1);
        target = REST + (PEAK - REST) * near * near * (3 - 2 * near);
      }
      l.weight += (target - l.weight) * k;
      if (Math.abs(l.weight - l.applied) > SETTLE) {
        l.applied = l.weight;
        l.node.style.fontWeight = l.weight.toFixed(0);
      } else if (target === REST && l.applied !== REST && Math.abs(l.weight - REST) <= SETTLE) {
        l.applied = REST;
        l.node.style.fontWeight = '';
      }
    }
  });

  return {
    /** Call once the intro has finished and the letters are at rest. */
    ready() {
      ready = true;
      stale = true;
    },
  };
}
