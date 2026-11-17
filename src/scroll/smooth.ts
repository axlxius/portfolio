import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

import { motion } from '../core/motion.ts';

gsap.registerPlugin(ScrollTrigger);

/**
 * Smooth scrolling, driven from GSAP's ticker so the scroll position, the
 * scroll-triggered reveals and the 3D scene are all sampled in one frame.
 *
 * With reduced motion there is no Lenis at all: the browser's native scroll is
 * used untouched and anchors jump instead of gliding.
 */
export function createSmoothScroll() {
  let lenis: Lenis | null = null;
  let locked = false;

  function enable() {
    if (lenis) return;
    lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      // Native momentum on touch feels better than a JS-driven substitute.
      syncTouch: false,
    });
    lenis.on('scroll', ScrollTrigger.update);
    if (locked) lenis.stop();
  }

  function disable() {
    lenis?.destroy();
    lenis = null;
  }

  if (!motion.reduced) enable();
  motion.onChange((reduced) => (reduced ? disable() : enable()));

  function scrollTo(target: number | HTMLElement, options: { duration?: number; immediate?: boolean } = {}) {
    if (lenis && !options.immediate) {
      lenis.scrollTo(target, { offset: 0, duration: options.duration });
      return;
    }
    const top = typeof target === 'number' ? target : target.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top, behavior: 'auto' });
  }

  // In-page anchors route through here so jumps are eased, not instant.
  document.addEventListener('click', (event) => {
    const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href^="#"]');
    if (!anchor || event.defaultPrevented) return;
    const id = anchor.getAttribute('href');
    if (!id || id === '#') return;
    const target = document.querySelector<HTMLElement>(id);
    if (!target) return;
    event.preventDefault();
    // A pinned scene sits at the far end of its spacer once played through;
    // its start is the top of the spacer.
    const spacer = target.parentElement?.classList.contains('pin-spacer') ? target.parentElement : null;
    scrollTo((spacer ?? target).getBoundingClientRect().top + window.scrollY);
    // Keep keyboard focus moving with the jump.
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });

  return {
    /** Call once per frame with the ticker time in seconds. */
    raf(time: number) {
      lenis?.raf(time * 1000);
    },
    /** Scroll speed in px per frame-ish units; 0 when scrolling natively. */
    get velocity() {
      return lenis?.velocity ?? 0;
    },
    scrollTo,
    /** Freeze page scroll while an overlay is open. */
    lock(state: boolean) {
      locked = state;
      if (state) lenis?.stop();
      else lenis?.start();
      document.documentElement.style.overflow = state ? 'hidden' : '';
    },
  };
}

export type SmoothScroll = ReturnType<typeof createSmoothScroll>;
