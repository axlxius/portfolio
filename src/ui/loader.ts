import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';

import { EASE, EASE_IO } from '../core/ease.ts';
import { el, qs, qsa } from '../core/env.ts';
import { motion } from '../core/motion.ts';
import { sceneRef } from '../core/refs.ts';

gsap.registerPlugin(SplitText);

/**
 * The intro sequence, about two seconds long.
 *
 * A counter and a hairline run while the particles fall out of scattered dust
 * and assemble into the hero form. The name then rises letter by letter
 * through its mask, thinning from a heavy weight to its hairline, and the
 * rest of the hero follows. Any key, click or scroll skips to the end.
 *
 * It is not a loading screen: nothing waits on it, and the page underneath is
 * already there. With reduced motion, or when the page loads part-way down,
 * it does not run at all.
 */
export function playIntro(onDone: () => void) {
  const root = document.documentElement;
  const name = qs('[data-hero-name]');
  const lead = qs('[data-hero-lead]');
  const rest = qsa('#intro [data-fade]');

  // The name is always split into letters: the hero's cursor effect needs them.
  const split = name
    ? SplitText.create(name, { type: 'chars', mask: 'chars', charsClass: 'char' })
    : null;
  const chars = (split?.chars ?? []) as HTMLElement[];

  const showAll = () => {
    [name, lead, ...rest].forEach((node) => node?.classList.add('is-in'));
    sceneRef.current?.setAssemble(1);
  };

  if (motion.reduced || window.scrollY > 40) {
    showAll();
    onDone();
    return { chars };
  }

  root.classList.add('is-loading');

  const loader = el('div', 'loader', { 'aria-hidden': 'true' });
  const row = el('div', 'loader-row');
  const count = Object.assign(el('span', 'loader-count mono'), { textContent: '000' });
  const skip = Object.assign(el('button', 'loader-skip mono', { type: 'button', tabindex: '-1' }), {
    textContent: 'Skip',
  });
  const line = el('div', 'loader-line');
  const fill = el('span');
  line.append(fill);
  row.append(count, skip);
  loader.append(row, line);
  document.body.append(loader);

  const words = lead
    ? (SplitText.create(lead, { type: 'words', wordsClass: 'word' }).words as HTMLElement[])
    : [];

  const state = { value: 0, assemble: 0 };
  const timeline = gsap.timeline({
    paused: true,
    onComplete: () => {
      loader.remove();
      root.classList.remove('is-loading');
      gsap.set([...chars, ...words, ...rest], { clearProps: 'all' });
      showAll();
      detach();
      onDone();
    },
  });

  timeline
    // Counter and hairline.
    .to(state, {
      value: 100,
      duration: 1.5,
      ease: EASE_IO,
      onUpdate: () => {
        count.textContent = String(Math.round(state.value)).padStart(3, '0');
        fill.style.transform = `scaleX(${state.value / 100})`;
      },
    }, 0)
    // Dust assembles into the hero form.
    .to(state, {
      assemble: 1,
      duration: 2.1,
      ease: 'power2.out',
      onUpdate: () => sceneRef.current?.setAssemble(state.assemble),
    }, 0)
    // The name: each letter rises through its mask and thins as it lands.
    .add(() => name?.classList.add('is-in'), 0.8)
    .fromTo(
      chars,
      { yPercent: 115, fontWeight: 560 },
      { yPercent: 0, fontWeight: 200, duration: 1.15, ease: EASE, stagger: 0.045 },
      0.8
    )
    // The loader steps aside and the header arrives.
    .to(loader, { opacity: 0, y: 12, duration: 0.5, ease: EASE }, 1.55)
    .add(() => root.classList.remove('is-loading'), 1.6)
    // Lead paragraph, word by word.
    .add(() => lead?.classList.add('is-in'), 1.45)
    .fromTo(
      words,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.6, ease: EASE, stagger: 0.014 },
      1.45
    )
    .fromTo(
      rest,
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.8, ease: EASE, stagger: 0.07 },
      1.85
    );

  const finish = () => timeline.progress(1);
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== 'Tab') finish();
  };
  function detach() {
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('wheel', finish);
    window.removeEventListener('touchmove', finish);
    window.removeEventListener('pointerdown', finish);
  }
  window.addEventListener('keydown', onKey);
  window.addEventListener('wheel', finish, { passive: true });
  window.addEventListener('touchmove', finish, { passive: true });
  window.addEventListener('pointerdown', finish);
  motion.onChange((reduced) => reduced && timeline.isActive() && finish());

  // Start once the display font is in, so the letters rise in the right face.
  // Never wait long: a slow font must not hold the page hostage.
  sceneRef.current?.setAssemble(0);
  Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 700))]).then(() => timeline.play());

  return { chars };
}
