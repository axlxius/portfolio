import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { EASE } from '../core/ease.ts';
import { qs, qsa } from '../core/env.ts';
import { motion } from '../core/motion.ts';
import { sceneRef } from '../core/refs.ts';

gsap.registerPlugin(ScrollTrigger);

/**
 * The 3D column is the timeline's spine. Whichever role is being read is the
 * current one: its date sharpens and its segment of the column lights. The
 * years in each date roll up into place the first time the role appears.
 */
export function createExperience() {
  const section = qs('#experience');
  const roles = qsa('[data-role]');
  if (!section || roles.length === 0) return;

  let current = -1;
  function setCurrent(next: number) {
    if (next === current) return;
    current = next;
    roles.forEach((role, i) => role.classList.toggle('is-current', i === next));
    sceneRef.current?.setRole(next < 0 ? null : next);
  }

  roles.forEach((role, i) => {
    ScrollTrigger.create({
      trigger: role,
      start: 'top 62%',
      end: 'bottom 38%',
      onToggle: (self) => {
        if (self.isActive) setCurrent(i);
        else if (current === i) setCurrent(-1);
      },
    });

    // Roll the years: each number counts up from a few years back.
    const date = role.querySelector<HTMLElement>('[data-role-date]');
    if (!date) return;
    const text = date.textContent ?? '';
    const years = [...text.matchAll(/\d{4}/g)].map((m) => Number(m[0]));
    if (years.length === 0) return;

    ScrollTrigger.create({
      trigger: role,
      start: 'top 88%',
      once: true,
      onEnter: () => {
        if (motion.reduced) return;
        const state = { k: 0 };
        gsap.to(state, {
          k: 1,
          duration: 1.1,
          ease: EASE,
          onUpdate: () => {
            let n = 0;
            date.textContent = text.replace(/\d{4}/g, () => String(Math.round(years[n] - (1 - state.k) * (7 + n++ * 3))));
          },
          onComplete: () => (date.textContent = text),
        });
      },
    });
  });

  // A hovered or focused role takes the light for as long as it is held.
  roles.forEach((role, i) => {
    const hold = () => sceneRef.current?.setRole(i);
    const release = () => sceneRef.current?.setRole(current < 0 ? null : current);
    role.addEventListener('pointerenter', hold);
    role.addEventListener('pointerleave', release);
    role.addEventListener('focus', hold);
    role.addEventListener('blur', release);
  });
}
