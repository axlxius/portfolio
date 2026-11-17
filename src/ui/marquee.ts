import gsap from 'gsap';

import { qs } from '../core/env.ts';
import { motion } from '../core/motion.ts';
import type { SmoothScroll } from '../scroll/smooth.ts';

const DRIFT = 42; // px per second at rest

/**
 * The oversized line between sections. It drifts slowly on its own and takes
 * its speed and direction from the scroll: scroll faster and it runs, scroll
 * back and it reverses.
 */
export function createMarquee(scroll: SmoothScroll) {
  const root = qs('[data-marquee]');
  const track = qs('[data-marquee-track]');
  const run = track?.firstElementChild as HTMLElement | null;
  if (!root || !track || !run) return;

  let x = 0;
  let direction = -1;
  let speed = 0;
  let visible = false;
  new IntersectionObserver((entries) => (visible = entries[0].isIntersecting)).observe(root);

  gsap.ticker.add((_time, deltaMs) => {
    if (!visible || motion.reduced) return;
    const dt = Math.min(deltaMs / 1000, 0.05);
    const v = scroll.velocity;
    if (Math.abs(v) > 0.5) direction = v > 0 ? -1 : 1;
    speed += (Math.abs(v) * 14 - speed) * Math.min(1, dt * 6);
    x += direction * (DRIFT + speed) * dt;

    // Two identical runs sit side by side; wrap by one run's width.
    const width = run.offsetWidth;
    if (x <= -width) x += width;
    if (x > 0) x -= width;
    track.style.transform = `translate3d(${x.toFixed(1)}px, 0, 0)`;
  });
}
