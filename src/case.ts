// Entry point for the project write-ups under /work/. They share the home
// page's palettes, type and Colour button; a write-up is for reading, so the
// only motion is the title slamming in.
import './styles/base.css';
import './styles/case.css';

import gsap from 'gsap';

import { qsa } from './core/env.ts';
import { motion } from './core/motion.ts';
import { createPalette } from './fx/palette.ts';
import { createTouch } from './fx/touch.ts';

document.documentElement.setAttribute('data-booted', '');

createPalette();
createTouch();

qsa('[data-reveal]').forEach((heading) => {
  if (motion.reduced) return;
  gsap.fromTo(
    heading,
    { xPercent: 30, skewX: -14, opacity: 0 },
    { xPercent: 0, skewX: 0, opacity: 1, duration: 0.8, ease: 'back.out(2.2)', clearProps: 'transform,opacity' }
  );
});
