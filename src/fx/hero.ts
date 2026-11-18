import gsap from 'gsap';

import { finePointer, qs, qsa } from '../core/env.ts';
import { motion } from '../core/motion.ts';

/**
 * The name. It is sized so the first line fills the width exactly, then
 * "inflates" on arrival: the letters drop in tumbling while the whole name
 * grows from a hairline weight and narrow width to the heaviest, widest
 * setting. Afterwards the letters bob in a slow wave (CSS), and each one
 * wobbles like jelly when a pointer touches it.
 */
export function createHero() {
  const name = qs('[data-hero-name]');
  if (!name) return;
  const lines = qsa('[data-hero-line]', name);
  const first = lines[0];

  // Split each line into letters. The heading keeps an accessible name.
  name.setAttribute('aria-label', lines.map((l) => l.textContent).join(' '));
  let i = 0;
  const letters: HTMLElement[] = [];
  lines.forEach((line) => {
    const text = line.textContent ?? '';
    line.replaceChildren(
      ...[...text].map((ch) => {
        const outer = document.createElement('span');
        outer.className = 'ch';
        outer.setAttribute('aria-hidden', 'true');
        outer.style.setProperty('--i', String(i++));
        const inner = document.createElement('span');
        inner.className = 'ch-in';
        inner.textContent = ch;
        outer.append(inner);
        letters.push(inner);
        return outer;
      })
    );
  });

  /** The size at which the first line fills the hero's content width. */
  function fit() {
    if (!first || !name) return;
    const box = name.parentElement;
    if (!box) return;
    const style = getComputedStyle(box);
    const room = box.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    // Measure at the final setting, even if the intro is mid-way through
    // inflating the name (fonts can arrive then).
    const { fontWeight, fontStretch } = name.style;
    name.style.fontWeight = '900';
    name.style.fontStretch = '112%';
    name.style.fontSize = '100px';
    // The line is a block, so measure its letters, not the box.
    const a = first.firstElementChild?.getBoundingClientRect();
    const b = first.lastElementChild?.getBoundingClientRect();
    const width = a && b ? b.right - a.left : 0;
    name.style.fontWeight = fontWeight;
    name.style.fontStretch = fontStretch;
    if (width > 0) name.style.fontSize = `${Math.floor((100 * room) / width) - 1}px`;
  }

  fit();
  document.fonts?.ready.then(fit).catch(() => {});
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(fit, 120);
  });

  let ready = false;
  const live = () => {
    ready = true;
    name.classList.add('is-in', 'is-live');
  };

  if (motion.reduced) {
    live();
  } else {
    name.classList.add('is-in');
    const tl = gsap.timeline({ delay: 0.15, onComplete: live });
    tl.fromTo(
      name,
      { fontWeight: 100, fontStretch: '55%' },
      { fontWeight: 900, fontStretch: '112%', duration: 1.3, ease: 'power3.inOut', clearProps: 'fontWeight,fontStretch' },
      0
    )
      .from(
        letters,
        {
          yPercent: -130,
          rotate: () => gsap.utils.random(-30, 30),
          opacity: 0,
          duration: 0.8,
          ease: 'back.out(1.8)',
          stagger: 0.055,
          clearProps: 'all',
        },
        0
      );
  }

  const jelly = (el: HTMLElement) => {
    if (!ready || motion.reduced || gsap.isTweening(el)) return;
    gsap.fromTo(
      el,
      { scaleX: 1.3, scaleY: 0.72 },
      { scaleX: 1, scaleY: 1, duration: 1, ease: 'elastic.out(1.2, 0.3)', clearProps: 'transform' }
    );
  };

  letters.forEach((el) => {
    if (finePointer) el.addEventListener('pointerenter', () => jelly(el));
    else el.addEventListener('pointerdown', () => jelly(el));
  });
}
