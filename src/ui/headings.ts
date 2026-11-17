import { clamp, damp, qsa } from '../core/env.ts';
import { motion } from '../core/motion.ts';

/**
 * Section headings lean with the scroll: a small skew that follows the scroll
 * velocity and settles when the page does. Applied to the heading elements
 * directly, so nothing else on the page restyles.
 */
export function createHeadingSkew() {
  const headings = qsa('.title, .display');
  let skew = 0;
  let applied = 0;

  return {
    update(velocity: number, dt: number) {
      const target = motion.reduced ? 0 : clamp(velocity * -0.09, -5, 5);
      skew += (target - skew) * damp(7, dt);
      if (Math.abs(skew - applied) < 0.02) return;
      applied = Math.abs(skew) < 0.02 ? 0 : skew;
      const value = applied === 0 ? '' : `skewX(${applied.toFixed(2)}deg)`;
      headings.forEach((h) => (h.style.transform = value));
    },
  };
}
