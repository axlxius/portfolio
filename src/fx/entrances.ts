import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { qs, qsa } from '../core/env.ts';
import { motion } from '../core/motion.ts';
import { createOdometer } from './odometer.ts';

gsap.registerPlugin(ScrollTrigger);

/**
 * Everything that arrives as it scrolls into view:
 *
 *  - section titles slam in sideways, overshoot and snap back;
 *  - project slabs slam in from alternate sides, tilted;
 *  - smaller blocks pop up;
 *  - the project count and the role years roll up like a counter.
 *
 * Each plays again if the visitor scrolls back above it and down again. With
 * reduced motion everything is simply shown, and numbers are set outright.
 */
export function createEntrances() {
  const show = (el: Element) => el.classList.add('is-in');
  const hide = (el: Element) => {
    el.classList.remove('is-in');
    gsap.killTweensOf(el);
    gsap.set(el, { clearProps: 'all' });
  };

  // --- Titles: a hit from the right.
  qsa('[data-slam]').forEach((el) => {
    ScrollTrigger.create({
      trigger: el,
      start: 'top 88%',
      onEnter: () => {
        show(el);
        if (motion.reduced) return;
        gsap.fromTo(
          el,
          { xPercent: 35, skewX: -14, opacity: 0 },
          { xPercent: 0, skewX: 0, opacity: 1, duration: 0.75, ease: 'back.out(2.2)', clearProps: 'transform,opacity' }
        );
      },
      onLeaveBack: () => hide(el),
    });
  });

  // --- Slabs: from alternate sides, the way a column would deal them.
  const slabs = qsa('[data-slab]');
  ScrollTrigger.batch(slabs, {
    start: 'top 92%',
    onEnter: (batch) => {
      batch.forEach(show);
      if (motion.reduced) return;
      gsap.fromTo(
        batch,
        {
          // Left column from the left, right column from the right.
          xPercent: (_i, el: Element) => (slabs.indexOf(el as HTMLElement) % 2 === 0 ? -70 : 70),
          rotate: (_i, el: Element) => (slabs.indexOf(el as HTMLElement) % 2 === 0 ? -6 : 6),
          opacity: 0,
        },
        {
          xPercent: 0,
          rotate: 0,
          opacity: 1,
          duration: 0.8,
          ease: 'back.out(1.5)',
          stagger: 0.09,
          clearProps: 'transform,opacity',
        }
      );
    },
    onLeaveBack: (batch) => batch.forEach(hide),
  });

  // --- Smaller blocks: pop up.
  ScrollTrigger.batch(qsa('[data-pop]'), {
    start: 'top 94%',
    onEnter: (batch) => {
      batch.forEach(show);
      if (motion.reduced) return;
      gsap.fromTo(
        batch,
        { y: 60, scale: 0.9, rotate: -2, opacity: 0 },
        { y: 0, scale: 1, rotate: 0, opacity: 1, duration: 0.7, ease: 'back.out(1.8)', stagger: 0.08, clearProps: 'all' }
      );
    },
    onLeaveBack: (batch) => batch.forEach(hide),
  });

  // --- Numbers that roll up: the project count, then each role's year.
  const rollers: Array<{ el: HTMLElement; to: string; from: string }> = [];
  const count = qs('[data-count]');
  if (count) rollers.push({ el: count, to: count.dataset.count ?? '', from: '00' });
  qsa('[data-roll]').forEach((el) => rollers.push({ el, to: el.dataset.roll ?? '', from: '1999' }));

  rollers.forEach(({ el, to, from }) => {
    const odo = createOdometer(el, motion.reduced ? to : from, { duration: 1.1 });
    ScrollTrigger.create({
      trigger: el,
      start: 'top 90%',
      onEnter: () => odo.set(to, 1),
      onLeaveBack: () => {
        if (!motion.reduced) odo.set(from, -1);
      },
    });
  });

  // --- The bar marks the section on screen.
  const links = qsa<HTMLAnchorElement>('[data-nav]');
  links.forEach((link) => {
    const section = qs(`#${link.dataset.nav}`);
    if (!section) return;
    ScrollTrigger.create({
      trigger: section,
      start: 'top 50%',
      end: 'bottom 50%',
      onToggle: (self) =>
        self.isActive ? link.setAttribute('aria-current', 'true') : link.removeAttribute('aria-current'),
    });
  });
}
