import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

import { EASE } from '../core/ease.ts';
import { qs, qsa } from '../core/env.ts';
import type { Wipes } from './wipes.ts';

gsap.registerPlugin(ScrollTrigger, SplitText);

interface TimelineOptions {
  wipes: Wipes;
  /** The role the playhead has reached (list order), or -1 before the first. */
  onRole: (index: number) => void;
}

/**
 * Scene 3, the timeline. Pinned and scrubbed:
 *
 *   0.0  a hairline draws across the screen, still in negative
 *   1.0  it thickens until it fills the screen: back to positive
 *   2.0  keyframes land on the line, each with its year
 *   2.8  a playhead runs along the line; each keyframe it passes lights,
 *        and that role's title rises into place below
 */
export function createTimeline({ wipes, onRole }: TimelineOptions): ScrollTrigger | null {
  const section = qs('#experience');
  const rail = qs('#experience .tl-rail');
  const line = qs('[data-tl-line]');
  const playhead = qs('[data-tl-playhead]');
  const keys = qsa('#experience .tl-key');
  const roles = qsa('#experience .tl-role');
  if (!section || !rail || !line || !playhead || keys.length === 0) return null;

  const cards = roles.map((role) => {
    const title = role.querySelector<HTMLElement>('[data-title]')!;
    const split = SplitText.create(title, { type: 'words,chars', mask: 'chars', charsClass: 'char', wordsClass: 'word' });
    return { chars: split.chars as HTMLElement[], dates: role.querySelector<HTMLElement>('.tl-dates')! };
  });
  cards.forEach((c) => {
    gsap.set(c.chars, { yPercent: 170 });
    gsap.set(c.dates, { opacity: 0 });
  });

  const diamonds = keys.map((k) => k.querySelector('.tl-diamond'));
  const years = keys.map((k) => k.querySelector('.tl-year'));
  gsap.set(line, { scaleX: 0 });
  gsap.set(diamonds, { scale: 0 });
  gsap.set(years, { opacity: 0, y: 24 });
  gsap.set(playhead, { opacity: 0, x: 0 });

  // Where each keyframe sits along the rail, as a fraction of its width.
  const keyAt = () => keys.map((k) => k.offsetLeft / Math.max(1, rail.clientWidth));
  const end = () => Math.min(0.96, (keyAt().at(-1) ?? 0.6) + 0.2);

  const state = { u: 0 };
  const tl = gsap.timeline({ defaults: { ease: 'none' } });
  tl.to(line, { scaleX: 1, duration: 1, ease: 'power2.inOut' }, 0)
    .to(state, {
      u: 1,
      duration: 1.2,
      ease: 'power1.inOut',
      onUpdate: () => wipes.setBand(state.u, rail.getBoundingClientRect().top),
    }, 1)
    .to(diamonds, { scale: 1, duration: 0.4, ease: 'back.out(3)', stagger: 0.15 }, 2.1)
    .to(years, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out', stagger: 0.15 }, 2.15)
    .to(playhead, { opacity: 1, duration: 0.15 }, 2.8)
    .fromTo(playhead, { x: 0 }, { x: () => rail.clientWidth * end(), duration: 6.6, immediateRender: false }, 2.8)
    .to({}, { duration: 0.6 }, 9.4);

  let current = -1;
  function setRole(next: number) {
    if (next === current) return;
    const prev = current;
    current = next;
    keys.forEach((k, i) => k.classList.toggle('is-passed', i <= next));
    onRole(next < 0 ? -1 : cards.length - 1 - next); // cards are oldest first

    if (prev >= 0) {
      gsap.to(cards[prev].chars, { yPercent: -170, duration: 0.4, ease: 'power3.in', stagger: { amount: 0.06 }, overwrite: true });
      gsap.to(cards[prev].dates, { opacity: 0, duration: 0.25, overwrite: true });
    }
    if (next >= 0) {
      gsap.fromTo(
        cards[next].chars,
        { yPercent: 170 },
        { yPercent: 0, duration: 0.75, ease: EASE, stagger: { amount: 0.14 }, delay: prev >= 0 ? 0.18 : 0, overwrite: true }
      );
      gsap.to(cards[next].dates, { opacity: 1, duration: 0.5, delay: 0.25, overwrite: true });
    }
  }

  return ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: '+=320%',
    pin: true,
    scrub: true,
    animation: tl,
    invalidateOnRefresh: true,
    onUpdate: () => {
      const x = (Number(gsap.getProperty(playhead, 'x')) || 0) / Math.max(1, rail.clientWidth);
      const visible = Number(gsap.getProperty(playhead, 'opacity')) > 0.5;
      const at = keyAt();
      let reached = -1;
      if (visible) at.forEach((k, i) => x >= k - 0.002 && (reached = i));
      setRole(reached);
    },
  });
}
