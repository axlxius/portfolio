import './styles/base.css';
import './styles/home.css';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { qs } from './core/env.ts';
import { motion } from './core/motion.ts';
import { createEntrances } from './fx/entrances.ts';
import { createHero } from './fx/hero.ts';
import { createMarquees } from './fx/marquee.ts';
import { createPalette } from './fx/palette.ts';
import { toast } from './fx/toast.ts';
import { burst, createTouch } from './fx/touch.ts';
import { createSmoothScroll } from './scroll/smooth.ts';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

// Tells the pre-paint script's failsafe that the page has come up.
document.documentElement.setAttribute('data-booted', '');

const scroll = createSmoothScroll();
createPalette();
createHero();
createEntrances();
createTouch();
const marquees = createMarquees(() => scroll.velocity);

// One loop for smooth scrolling and the scroll-aware bands.
gsap.ticker.lagSmoothing(0);
gsap.ticker.add((time) => {
  scroll.raf(time);
  marquees.update();
});

// --- The Motion switch -------------------------------------------------------------
const motionButton = qs<HTMLButtonElement>('[data-motion-toggle]');
function paintMotion(reduced: boolean) {
  motionButton?.setAttribute('aria-pressed', String(reduced));
  motionButton?.setAttribute('aria-label', reduced ? 'Motion is off. Turn it back on' : 'Turn motion off');
}
motionButton?.addEventListener('click', () => motion.toggle());
motion.onChange((reduced) => {
  paintMotion(reduced);
  ScrollTrigger.refresh();
});
paintMotion(motion.reduced);

// --- Singapore time in the footer ---------------------------------------------------
const clock = qs('[data-clock]');
if (clock) {
  const format = new Intl.DateTimeFormat('en-SG', { timeZone: 'Asia/Singapore', hour: '2-digit', minute: '2-digit' });
  const tick = () => (clock.textContent = format.format(new Date()));
  tick();
  window.setInterval(tick, 30_000);
}

// --- A reward for the curious: the Konami code throws confetti ------------------------
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
let step = 0;
window.addEventListener('keydown', (event) => {
  if ((event.target as Element | null)?.closest('input, textarea, select, [contenteditable]')) return;
  step = event.key === KONAMI[step] ? step + 1 : event.key === KONAMI[0] ? 1 : 0;
  if (step < KONAMI.length) return;
  step = 0;
  toast('Cheat code accepted');
  for (let i = 0; i < 7; i++) {
    window.setTimeout(
      () => burst(Math.random() * window.innerWidth, Math.random() * window.innerHeight * 0.8, 12, 1.6),
      i * 110
    );
  }
});
