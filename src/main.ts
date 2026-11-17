import './styles/base.css';
import './styles/layout.css';
import './styles/ui.css';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { PROJECTS } from './data/content.ts';
import { qs, qsa } from './core/env.ts';
import { motion } from './core/motion.ts';
import { sceneRef } from './core/refs.ts';
import type { TakeoverId } from './scene/projects.ts';
import { bindMotionSwitch, createHud } from './scenes/hud.ts';
import { createKit } from './scenes/kit.ts';
import { createReel } from './scenes/reel.ts';
import { createTimeline } from './scenes/timeline.ts';
import { createTitleScene } from './scenes/title.ts';
import { createWipes } from './scenes/wipes.ts';
import { createSectionProgress } from './scroll/progress.ts';
import { createSmoothScroll } from './scroll/smooth.ts';
import { createContact } from './sections/contact.ts';
import { createHeroName } from './sections/intro.ts';
import { createCursor } from './ui/cursor.ts';
import { createEasterEggs } from './ui/eggs.ts';
import { createGrain } from './ui/grain.ts';
import { createHeadingSkew } from './ui/headings.ts';
import { playIntro } from './ui/loader.ts';
import { createMagnetics } from './ui/magnetic.ts';
import { createOverlay } from './ui/overlay.ts';
import { createReveals, revealAll } from './ui/reveal.ts';
import { createSound } from './ui/sound.ts';
import { createTheme } from './ui/theme.ts';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

const root = document.documentElement;
// Tells the pre-paint script's failsafe that the page has come up.
root.setAttribute('data-booted', '');

const sections = qsa('[data-section]');

// --- Chrome ---------------------------------------------------------------------
const scroll = createSmoothScroll();
const hud = createHud(sections);
bindMotionSwitch();
const headings = createHeadingSkew();
createCursor();
createGrain();
createMagnetics();
const sound = createSound(scroll);
const overlay = createOverlay(scroll);

// The particles' ink follows the theme, and flips while a scene plays in
// negative. The page's own colours flip through CSS (data-invert).
const wipes = createWipes(() => applyInk(false));
function applyInk(instant: boolean) {
  const mode = root.dataset.theme === 'dark' ? 'dark' : 'light';
  const flipped = mode === 'dark' ? 'light' : 'dark';
  sceneRef.current?.setTheme(wipes.inkInverted ? flipped : mode, instant);
}

const theme = createTheme((_mode, instant) => {
  applyInk(instant);
  overlay.refresh();
});

// --- Static content behaviour ------------------------------------------------------
let heroName: ReturnType<typeof createHeroName> = null;
let introDone = false;
const intro = playIntro(() => {
  introDone = true;
  heroName?.ready();
  ScrollTrigger.refresh();
});
heroName = createHeroName(intro.chars);
if (introDone) heroName?.ready();

createReveals();
createContact(scroll);

// --- The scenes -------------------------------------------------------------------
// With motion, the first three scenes are pinned and scrubbed. Without it the
// page is a plain stack of sections, and the cloud follows section anchors.
const anchorsStatic = createSectionProgress(sections);
let director: ReturnType<typeof buildScenes> | null = null;
let inReel = false;

function buildScenes() {
  const triggers: Record<string, ScrollTrigger | null> = {};
  const ctx = gsap.context(() => {
    triggers.title = createTitleScene({
      chars: intro.chars,
      wipes,
      onZoom: (factor) => sceneRef.current?.setZoom(factor),
    });
    triggers.reel = createReel({
      overlay,
      scroll,
      onProject: (i) => {
        inReel = i >= 0;
        sceneRef.current?.setTakeover(i >= 0 ? (PROJECTS[i].visual as TakeoverId) : null);
        sceneRef.current?.setBand(i >= 0 ? i : null);
      },
    });
    triggers.timeline = createTimeline({
      wipes,
      onRole: (i) => sceneRef.current?.setRole(i < 0 ? null : i),
    });
    triggers.kit = createKit();
  });

  // Morph stops: each pinned scene holds its form for the length of its pin,
  // and the cloud reforms in the scroll between scenes.
  let anchors: Array<[number, number]> = [];
  function measure() {
    const vh = window.innerHeight;
    const max = Math.max(1, document.documentElement.scrollHeight - vh);
    const top = (id: string) => (qs(`#${id}`)?.getBoundingClientRect().top ?? 0) + window.scrollY;
    const { title, reel, timeline } = triggers;
    const kitTop = top('stack');
    const kitHeight = qs('#stack')?.offsetHeight ?? vh;
    const endTop = top('contact');

    const list: Array<[number, number]> = [
      [0, 0],
      [title?.end ?? 0, 0],
      [reel?.start ?? vh, 1],
      [reel?.end ?? vh * 2, 1],
      [timeline?.start ?? vh * 3, 2],
      [timeline?.end ?? vh * 4, 2],
      [kitTop + kitHeight / 2 - vh / 2, 3],
      [endTop - vh * 0.2, 4],
      [max, 5],
    ];
    for (let i = 1; i < list.length; i++) list[i][0] = Math.max(list[i][0], list[i - 1][0] + 1);
    anchors = list;

    hud.setStarts([0, reel?.start ?? 0, timeline?.start ?? 0, kitTop, endTop]);
  }
  ScrollTrigger.addEventListener('refresh', measure);

  return {
    progressAt(y: number) {
      if (anchors.length === 0) return 0;
      if (y <= anchors[0][0]) return anchors[0][1];
      for (let i = 1; i < anchors.length; i++) {
        const [y1, v1] = anchors[i];
        if (y < y1) {
          const [y0, v0] = anchors[i - 1];
          return v0 + ((y - y0) / (y1 - y0)) * (v1 - v0);
        }
      }
      return anchors[anchors.length - 1][1];
    },
    destroy() {
      ScrollTrigger.removeEventListener('refresh', measure);
      ctx.revert();
    },
  };
}

function staticStarts() {
  hud.setStarts(sections.map((s) => s.getBoundingClientRect().top + window.scrollY));
}

function setMode(reduced: boolean) {
  director?.destroy();
  director = null;
  wipes.reset();
  inReel = false;
  const scene = sceneRef.current;
  scene?.setZoom(1);
  scene?.setTakeover(null);
  scene?.setBand(null);
  scene?.setRole(null);

  if (reduced) {
    revealAll();
    requestAnimationFrame(() => {
      ScrollTrigger.refresh();
      anchorsStatic.measure();
      staticStarts();
    });
  } else {
    director = buildScenes();
    ScrollTrigger.refresh();
  }
}

setMode(motion.reduced);
motion.onChange(setMode);
window.addEventListener('resize', () => !director && staticStarts(), { passive: true });
document.fonts?.ready.then(() => ScrollTrigger.refresh());

createEasterEggs(theme.toggle, () => overlay.isOpen || inReel);

// --- The 3D scene -------------------------------------------------------------------
// Debug aids, documented in the README: ?p=2.5 pins the morph progress,
// ?alt=dashboard forces a takeover shape, ?tier=high|mid|low picks a quality.
const params = new URLSearchParams(location.search);
const pinned = params.has('p') ? Number(params.get('p')) : null;
const morphAt = (y: number) => pinned ?? (director ? director.progressAt(y) : anchorsStatic.valueAt(y));

// WebGL is loaded after first paint: the text is the page, the scene is the
// atmosphere. Where WebGL is missing the module is never downloaded.
async function startScene() {
  const canvas = qs<HTMLCanvasElement>('[data-scene]');
  if (!canvas) return;
  if (!document.createElement('canvas').getContext('webgl2')) {
    root.setAttribute('data-no-webgl', '');
    return;
  }
  try {
    const { default: Scene } = await import('./scene/Scene.ts');
    const scene = new Scene(canvas);
    sceneRef.current = scene;
    applyInk(true);
    scene.setProgress(morphAt(window.scrollY), true);
    // If the intro is still running, join it where it is.
    if (root.classList.contains('is-loading')) scene.setAssemble(0);
    const alt = params.get('alt');
    if (alt) scene.setTakeover(alt as TakeoverId);
  } catch (error) {
    console.warn('3D scene unavailable, continuing without it.', error);
    root.setAttribute('data-no-webgl', '');
  }
}
requestAnimationFrame(() => void startScene());

// --- One loop -----------------------------------------------------------------------
// Lenis, the scrubbed scenes, the HUD and the render all run from GSAP's
// ticker, so the morph is never a frame behind the scroll that produced it.
gsap.ticker.lagSmoothing(0);
gsap.ticker.add((time, deltaMs) => {
  // Clamped so a backgrounded tab returning to focus does not deliver one
  // enormous delta and snap every easing straight to its target.
  const dt = Math.min(deltaMs / 1000, 0.05);
  scroll.raf(time);
  hud.update();
  headings.update(scroll.velocity, dt);
  sound?.update();

  const scene = sceneRef.current;
  if (scene) {
    scene.setProgress(morphAt(window.scrollY));
    scene.setScrollVelocity(scroll.velocity);
    scene.update(dt);
  }
});
