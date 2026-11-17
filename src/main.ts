import './styles/base.css';
import './styles/layout.css';
import './styles/ui.css';

import gsap from 'gsap';

import { qsa } from './core/env.ts';
import { motion } from './core/motion.ts';
import { createSectionProgress } from './scroll/progress.ts';
import { createSmoothScroll } from './scroll/smooth.ts';
import { createCursor } from './ui/cursor.ts';
import { createGrain } from './ui/grain.ts';
import { createHeader } from './ui/header.ts';
import { createMagnetics } from './ui/magnetic.ts';
import { createReveals, revealAll } from './ui/reveal.ts';
import { createTheme } from './ui/theme.ts';

const root = document.documentElement;
root.setAttribute('data-booted', '');

const sections = qsa('[data-section]');

createTheme(() => {});
const scroll = createSmoothScroll();
const header = createHeader(sections);
createSectionProgress(sections);
createGrain();
createCursor();
createMagnetics();
createReveals();

// TEMP until the intro sequence exists: show the hero.
qsa('#intro [data-fade], [data-hero-lead], [data-hero-name]').forEach((n) => n.classList.add('is-in'));

motion.onChange((reduced) => {
  if (reduced) revealAll();
});

gsap.ticker.lagSmoothing(0);
gsap.ticker.add((time) => {
  scroll.raf(time);
  header.update();
});
