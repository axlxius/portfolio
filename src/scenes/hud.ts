import gsap from 'gsap';

import { EASE } from '../core/ease.ts';
import { el, qs, qsa } from '../core/env.ts';
import { motion } from '../core/motion.ts';
import { createOdometer } from '../ui/odometer.ts';

// The page reads as a short film: the whole scroll maps to this running time.
const RUNTIME = 96; // seconds
const FPS = 24;

const pad2 = (n: number) => String(Math.floor(n)).padStart(2, '0');

/** Seconds as an editing timecode, HH:MM:SS:FF. */
export function timecode(seconds: number): string {
  const frames = Math.round(seconds * FPS);
  const ff = frames % FPS;
  const s = Math.floor(frames / FPS);
  return `${pad2(s / 3600)}:${pad2((s / 60) % 60)}:${pad2(s % 60)}:${pad2(ff)}`;
}

/**
 * The heads-up display: the scene label (which rolls like an odometer), a
 * running timecode whose digits roll over with the scroll, and the scrubber along the bottom with its playhead.
 * The scrubber's marks are the section links; once the page is laid out each
 * one sits where its scene starts.
 */
export function createHud(sections: HTMLElement[]) {
  const roll = qs('[data-hud-roll]');
  const tc = qs('[data-timecode]');
  const scrubber = qs('.scrubber');
  const fill = qs('[data-scrub-fill]');
  const playhead = qs('[data-playhead]');
  const marks = qsa<HTMLAnchorElement>('[data-mark]');

  let starts: number[] = sections.map((s) => s.offsetTop);
  let index = -1;
  let lastY = window.scrollY;
  // Frames turn over fastest, so the timecode's digits settle quickly; the
  // seconds and minutes still read as a counter rolling over.
  const counter = tc ? createOdometer(tc, timecode(0), { duration: 0.32 }) : null;

  function label(i: number) {
    return `${String(i + 1).padStart(2, '0')} ${sections[i].dataset.section ?? ''}`;
  }

  function setScene(next: number) {
    if (next === index) return;
    const down = next > index;
    index = next;
    marks.forEach((a, i) => (i === next ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
    if (!roll) return;

    const incoming = Object.assign(el('span'), { textContent: label(next) });
    if (motion.reduced || !roll.lastElementChild) {
      roll.replaceChildren(incoming);
      return;
    }
    // The new label slides in after (or before) the old one, like a digit
    // turning over.
    gsap.killTweensOf(roll);
    const outgoing = roll.lastElementChild;
    roll.replaceChildren(...(down ? [outgoing, incoming] : [incoming, outgoing]));
    gsap.fromTo(
      roll,
      { yPercent: down ? 0 : -50 },
      {
        yPercent: down ? -50 : 0,
        duration: 0.6,
        ease: EASE,
        onComplete: () => {
          roll.replaceChildren(incoming);
          gsap.set(roll, { yPercent: 0 });
        },
      }
    );
  }

  function place() {
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const width = scrubber?.clientWidth ?? window.innerWidth;
    const at = marks.map((_, i) => Math.min(1, (starts[i] ?? 0) / max));
    marks.forEach((a, i) => {
      a.parentElement?.style.setProperty('--at', `${(at[i] * 100).toFixed(2)}%`);
      // Room for "05 Toolkit" beside its neighbours, or just the number. A
      // label near the right edge hangs left, so it needs room on that side.
      const end = at[i] > 0.9;
      const after = ((at[i + 1] ?? 1.12) - at[i]) * width;
      const before = (at[i] - (at[i - 1] ?? -1)) * width;
      a.classList.toggle('is-tight', after < 120 || (end && before < 120));
      a.classList.toggle('is-end', end);
      a.title = sections[i].dataset.section ?? '';
    });
    scrubber?.classList.add('is-live');
  }

  window.addEventListener('resize', place, { passive: true });

  return {
    /** Scroll offsets where each scene begins. */
    setStarts(next: number[]) {
      starts = next;
      place();
    },
    /** Call once per frame. */
    update() {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const y = window.scrollY;
      const p = Math.min(1, Math.max(0, y / max));

      const mid = y + window.innerHeight * 0.5;
      let now = 0;
      for (let i = 1; i < starts.length; i++) if (starts[i] <= mid) now = i;
      setScene(now);

      counter?.set(timecode(p * RUNTIME), y > lastY ? 1 : y < lastY ? -1 : 0);
      lastY = y;
      fill?.style.setProperty('--p', p.toFixed(4));
      if (scrubber && playhead) {
        playhead.style.transform = `translate3d(${(p * scrubber.clientWidth).toFixed(1)}px, 0, 0)`;
      }
    },
  };
}

export type Hud = ReturnType<typeof createHud>;

/** The Motion switch in the HUD. */
export function bindMotionSwitch() {
  const button = qs<HTMLButtonElement>('[data-motion-toggle]');
  function paint(reduced: boolean) {
    if (!button) return;
    button.setAttribute('aria-pressed', String(reduced));
    button.toggleAttribute('data-off', reduced);
    button.title = reduced ? 'Motion is reduced. Turn it back on.' : 'Reduce motion';
  }
  button?.addEventListener('click', () => motion.toggle());
  motion.onChange(paint);
  paint(motion.reduced);
}
