import gsap from 'gsap';

import { EASE } from '../core/ease.ts';
import { el, finePointer, qs, qsa } from '../core/env.ts';
import { motion } from '../core/motion.ts';

/**
 * The fixed header: a section nav whose label rolls like an odometer, the
 * Motion switch, and a hairline of scroll progress along the top edge.
 */
export function createHeader(sections: HTMLElement[]) {
  const nav = qs('[data-nav-root]');
  const current = qs<HTMLButtonElement>('[data-nav-current]');
  const roll = qs('[data-nav-roll]');
  const links = qsa<HTMLAnchorElement>('[data-nav]');

  // --- Odometer ---------------------------------------------------------------
  let index = 0;

  function setCurrent(next: number) {
    if (next === index || !roll) return;
    const down = next > index;
    index = next;
    const label = sections[next].dataset.section ?? '';

    links.forEach((a, i) => {
      if (i === next) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });

    if (motion.reduced) {
      roll.replaceChildren(Object.assign(el('span'), { textContent: label }));
      return;
    }

    // The new label is placed after (or before) the old one and the strip
    // slides one line, like a digit turning over.
    gsap.killTweensOf(roll);
    const incoming = Object.assign(el('span'), { textContent: label });
    const outgoing = roll.lastElementChild;
    roll.replaceChildren(...(down ? [outgoing!, incoming] : [incoming, outgoing!]));
    gsap.fromTo(
      roll,
      { yPercent: down ? 0 : -50 },
      {
        yPercent: down ? -50 : 0,
        duration: 0.7,
        ease: EASE,
        onComplete: () => {
          roll.replaceChildren(incoming);
          gsap.set(roll, { yPercent: 0 });
        },
      }
    );
  }

  links[0]?.setAttribute('aria-current', 'true');

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) setCurrent(sections.indexOf(entry.target as HTMLElement));
      }
    },
    { rootMargin: '-45% 0px -45% 0px' }
  );
  sections.forEach((s) => observer.observe(s));

  // --- Disclosure -------------------------------------------------------------
  function setOpen(open: boolean) {
    if (!nav || !current) return;
    if (open) nav.setAttribute('data-open', '');
    else nav.removeAttribute('data-open');
    current.setAttribute('aria-expanded', String(open));
  }

  current?.addEventListener('click', () => setOpen(!nav?.hasAttribute('data-open')));
  if (finePointer) {
    nav?.addEventListener('pointerenter', () => setOpen(true));
    nav?.addEventListener('pointerleave', () => setOpen(false));
  }
  nav?.addEventListener('focusout', (event) => {
    if (!nav.contains(event.relatedTarget as Node | null)) setOpen(false);
  });
  nav?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setOpen(false);
      current?.focus();
    }
  });
  links.forEach((a) => a.addEventListener('click', () => setOpen(false)));

  // --- Motion switch ------------------------------------------------------------
  const motionToggle = qs<HTMLButtonElement>('[data-motion-toggle]');
  function paintMotion(reduced: boolean) {
    if (!motionToggle) return;
    motionToggle.setAttribute('aria-pressed', String(reduced));
    motionToggle.toggleAttribute('data-off', reduced);
    motionToggle.title = reduced ? 'Motion is reduced. Turn it back on.' : 'Reduce motion';
  }
  motionToggle?.addEventListener('click', () => motion.toggle());
  motion.onChange(paintMotion);
  paintMotion(motion.reduced);

  // --- Scroll progress ------------------------------------------------------------
  const bar = el('div', 'progress', { 'aria-hidden': 'true' });
  const fill = el('span');
  bar.append(fill);
  document.body.append(bar);

  return {
    /** Call once per frame. */
    update() {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? window.scrollY / max : 0;
      fill.style.setProperty('--progress', p.toFixed(4));
    },
  };
}
