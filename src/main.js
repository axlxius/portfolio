import './styles/base.css';
import './styles/layout.css';

import Scene from './scene/Scene.js';
import { parseBands } from './scene/bands.js';
import { createSectionProgress } from './scroll/progress.js';
import { createSmoothScroll } from './scroll/smooth.js';
import { createReveals } from './ui/reveal.js';
import { createTheme } from './ui/theme.js';

const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const reducedMotion = motionQuery.matches;

const canvas = document.querySelector('[data-scene]');
const sections = Array.from(document.querySelectorAll('[data-section]'));
const strandRows = Array.from(document.querySelectorAll('[data-strand]'));
// Each project row owns one hoop of the Work form, in list order.
const projectBands = parseBands(strandRows.map((el) => el.dataset.strand));

let scene = null;

// WebGL can be missing, blocked, or fail to compile. The page is written to
// stand on its own, so the only thing a failure costs is the 3D layer.
try {
  scene = new Scene(canvas, { reducedMotion, projectBands });
} catch (error) {
  console.warn('3D scene unavailable, continuing without it.', error);
  canvas?.remove();
  document.documentElement.setAttribute('data-no-webgl', '');
}

createTheme({
  onChange: (_mode, ink) => scene?.setInk(ink),
});

createReveals({ reducedMotion });

const progress = createSectionProgress(sections);
const lenis = createSmoothScroll({ reducedMotion });

// Hovering a project lights the band of strands carrying that project's index.
strandRows.forEach((el) => {
  const [band] = parseBands([el.dataset.strand]);
  if (band === undefined) return;
  const focus = () => scene?.setFocus(band);
  const release = () => scene?.setFocus(null);

  el.addEventListener('pointerenter', focus);
  el.addEventListener('pointerleave', release);
  el.addEventListener('focusin', focus);
  el.addEventListener('focusout', release);
});

// Section names drive the marker in the corner; it reports where you are
// rather than decorating the edge of the page.
const marker = document.querySelector('[data-marker]');
if (marker && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          marker.textContent = entry.target.dataset.section;
        }
      });
    },
    { rootMargin: '-45% 0px -45% 0px' }
  );
  sections.forEach((el) => observer.observe(el));
}

// One rAF loop drives Lenis, the scroll mapping and the render, so the morph
// is never a frame behind the scroll position that produced it.
let last = performance.now();

function frame(time) {
  requestAnimationFrame(frame);

  // Clamped so a backgrounded tab returning to focus does not deliver one
  // enormous delta and snap the easing straight to its target.
  const dt = Math.min((time - last) / 1000, 0.05);
  last = time;

  lenis?.raf(time);

  if (scene) {
    scene.setProgress(progress.valueAt(window.scrollY));
    if (dt > 0) scene.update(dt);
  }
}

requestAnimationFrame(frame);

// Landing mid-page on a reload should start at the right state, not animate in.
window.addEventListener('load', () => {
  progress.measure();
  const value = progress.valueAt(window.scrollY);
  scene?.setProgress(value);
  if (scene) scene.progress = value;
  document.documentElement.setAttribute('data-ready', '');
});
