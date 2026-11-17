import './styles/base.css';
import './styles/layout.css';
import './styles/ui.css';

import gsap from 'gsap';

import { finePointer, qs, qsa } from './core/env.ts';
import { motion } from './core/motion.ts';
import { sceneRef } from './core/refs.ts';
import type { TakeoverId } from './scene/projects.ts';
import { createSectionProgress } from './scroll/progress.ts';
import { createSmoothScroll } from './scroll/smooth.ts';
import { createContact } from './sections/contact.ts';
import { createExperience } from './sections/experience.ts';
import { createHeroName } from './sections/intro.ts';
import { createStackField } from './sections/stack.ts';
import { createWork } from './sections/work.ts';
import { createCursor } from './ui/cursor.ts';
import { createDotGrid } from './ui/dotgrid.ts';
import { createEasterEggs } from './ui/eggs.ts';
import { createGrain } from './ui/grain.ts';
import { createHeader } from './ui/header.ts';
import { createHeadingSkew } from './ui/headings.ts';
import { playIntro } from './ui/loader.ts';
import { createMagnetics } from './ui/magnetic.ts';
import { createMarquee } from './ui/marquee.ts';
import { createOverlay } from './ui/overlay.ts';
import { createPreview } from './ui/preview.ts';
import { createReveals, revealAll } from './ui/reveal.ts';
import { createSound } from './ui/sound.ts';
import { createTheme } from './ui/theme.ts';

const root = document.documentElement;
// Tells the pre-paint script's failsafe that the page has come up.
root.setAttribute('data-booted', '');

const sections = qsa('[data-section]');

// --- Chrome and scroll ----------------------------------------------------------
const dotGrid = createDotGrid();
const scroll = createSmoothScroll();
const header = createHeader(sections);
const progress = createSectionProgress(sections);
const headings = createHeadingSkew();
const cursor = createCursor();
const preview = finePointer ? createPreview() : null;
const overlay = createOverlay(scroll);

const theme = createTheme((mode, instant) => {
  sceneRef.current?.setTheme(mode, instant);
  // Canvases that draw in the page's ink need to re-read it.
  dotGrid?.refresh();
  preview?.refresh();
  overlay.refresh();
});

createGrain();
createMagnetics();
createMarquee(scroll);
const sound = createSound(scroll);

// --- Sections ---------------------------------------------------------------------
const intro = playIntro(() => {
  // Once the hero has landed, the scroll reveals take over.
  progress.measure();
});
createHeroName(intro.chars);
createReveals();
createWork(overlay, preview);
createExperience();
createStackField(cursor);
createContact(scroll);
createEasterEggs(theme.toggle, () => overlay.isOpen);

motion.onChange((reduced) => {
  if (reduced) revealAll();
});

// --- The 3D scene -------------------------------------------------------------------
// Debug aids, documented in the README: ?p=2.5 pins the morph progress,
// ?alt=dashboard forces a takeover shape, ?tier=high|mid|low picks a quality.
const params = new URLSearchParams(location.search);
const pinned = params.has('p') ? Number(params.get('p')) : null;

// WebGL is loaded after first paint: the text is the page, the scene is the
// atmosphere. It can also be missing, blocked, or fail to compile, in which
// case the only thing lost is the 3D layer.
async function startScene() {
  const canvas = qs<HTMLCanvasElement>('[data-scene]');
  if (!canvas) return;
  try {
    const { default: Scene } = await import('./scene/Scene.ts');
    const scene = new Scene(canvas);
    scene.setTheme(theme.resolved(), true);
    scene.setProgress(pinned ?? progress.valueAt(window.scrollY), true);
    // If the intro is still running, join it where it is.
    if (root.classList.contains('is-loading')) scene.setAssemble(0);
    const alt = params.get('alt');
    if (alt) scene.setTakeover(alt as TakeoverId);
    sceneRef.current = scene;
  } catch (error) {
    console.warn('3D scene unavailable, continuing without it.', error);
    root.setAttribute('data-no-webgl', '');
  }
}
requestAnimationFrame(() => void startScene());

// --- One loop -----------------------------------------------------------------------
// Lenis, the scroll mapping, the reveals and the render all run from GSAP's
// ticker, so the morph is never a frame behind the scroll that produced it.
gsap.ticker.lagSmoothing(0);
gsap.ticker.add((time, deltaMs) => {
  // Clamped so a backgrounded tab returning to focus does not deliver one
  // enormous delta and snap every easing straight to its target.
  const dt = Math.min(deltaMs / 1000, 0.05);
  scroll.raf(time);
  header.update();
  headings.update(scroll.velocity, dt);
  dotGrid?.update(dt);
  sound?.update();

  const scene = sceneRef.current;
  if (scene) {
    scene.setProgress(pinned ?? progress.valueAt(window.scrollY));
    scene.setScrollVelocity(scroll.velocity);
    scene.update(dt);
  }
});
