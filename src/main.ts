import './styles/base.css';
import './styles/layout.css';
import './styles/ui.css';

import gsap from 'gsap';

import { qs, qsa } from './core/env.ts';
import { motion } from './core/motion.ts';
import type { TakeoverId } from './scene/projects.ts';
import type Scene from './scene/Scene.ts';
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

let scene: Scene | null = null;

const theme = createTheme((mode, instant) => scene?.setTheme(mode, instant));
const scroll = createSmoothScroll();
const header = createHeader(sections);
const progress = createSectionProgress(sections);
createGrain();
createCursor();
createMagnetics();
createReveals();

// TEMP until the intro sequence exists: show the hero.
qsa('#intro [data-fade], [data-hero-lead], [data-hero-name]').forEach((n) => n.classList.add('is-in'));

motion.onChange((reduced) => {
  if (reduced) revealAll();
});

// Debug aids, documented in the README: ?p=2.5 pins the morph progress,
// ?alt=dashboard forces a takeover shape, ?tier=high|mid|low picks a quality.
const params = new URLSearchParams(location.search);
const pinned = params.has('p') ? Number(params.get('p')) : null;

// WebGL is loaded after first paint: the text is the page, the scene is the
// atmosphere. It can also be missing, blocked, or fail to compile, in which
// case the only thing lost is the 3D layer.
const canvas = qs<HTMLCanvasElement>('[data-scene]');
async function startScene() {
  if (!canvas) return;
  try {
    const { default: SceneClass } = await import('./scene/Scene.ts');
    scene = new SceneClass(canvas);
    scene.setTheme(theme.resolved(), true);
    scene.setProgress(pinned ?? progress.valueAt(window.scrollY), true);
    const alt = params.get('alt');
    if (alt) scene.setTakeover(alt as TakeoverId);
  } catch (error) {
    console.warn('3D scene unavailable, continuing without it.', error);
    root.setAttribute('data-no-webgl', '');
  }
}
requestAnimationFrame(() => void startScene());

// One loop drives Lenis, the scroll mapping and the render, so the morph is
// never a frame behind the scroll position that produced it.
gsap.ticker.lagSmoothing(0);
gsap.ticker.add((time, deltaMs) => {
  // Clamped so a backgrounded tab returning to focus does not deliver one
  // enormous delta and snap every easing straight to its target.
  const dt = Math.min(deltaMs / 1000, 0.05);
  scroll.raf(time);
  header.update();
  if (scene) {
    scene.setProgress(pinned ?? progress.valueAt(window.scrollY));
    scene.setScrollVelocity(scroll.velocity);
    scene.update(dt);
  }
});
