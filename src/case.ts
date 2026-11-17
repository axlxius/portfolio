// Entry point for the project write-ups under /work/. They share the home
// page's type, palette, theme toggle and cursor, but not the WebGL scene: a
// write-up is for reading, and the scene is the home page's navigation device.
import './styles/base.css';
import './styles/case.css';
import './styles/ui.css';

import gsap from 'gsap';

import { EASE } from './core/ease.ts';
import { qsa } from './core/env.ts';
import { motion } from './core/motion.ts';
import { WIDE } from './core/type.ts';
import { createCursor } from './ui/cursor.ts';
import { createGrain } from './ui/grain.ts';
import { createTheme } from './ui/theme.ts';

document.documentElement.setAttribute('data-booted', '');

createTheme(() => {});
createGrain();
createCursor();

qsa('[data-reveal]').forEach((heading) => {
  const inner = heading.querySelector<HTMLElement>('.title-inner');
  heading.classList.add('is-in');
  if (!inner || motion.reduced) return;
  gsap.fromTo(
    inner,
    { yPercent: 108, fontStretch: '72%' },
    { yPercent: 0, fontStretch: WIDE, duration: 1.25, ease: EASE, clearProps: 'transform,fontStretch' }
  );
});
