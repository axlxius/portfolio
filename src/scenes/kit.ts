import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { qs, qsa } from '../core/env.ts';

gsap.registerPlugin(ScrollTrigger);

/**
 * Scene 4, the toolkit. Each skill group is one long line of outlined type,
 * and the lines slide against each other as the section passes: alternate
 * rows run in opposite directions.
 */
export function createKit(): ScrollTrigger | null {
  const section = qs('#stack');
  const rows = qsa('#stack .kit-words');
  if (!section || rows.length === 0) return null;

  // How far a row can travel and still keep the screen filled.
  const travel = (row: HTMLElement) => Math.max(0, row.scrollWidth - window.innerWidth * 0.7);

  const tl = gsap.timeline({ defaults: { ease: 'none' } });
  rows.forEach((row, i) => {
    const forward = i % 2 === 0;
    tl.fromTo(
      row,
      { x: () => (forward ? window.innerWidth * 0.12 : -travel(row)) },
      { x: () => (forward ? -travel(row) : window.innerWidth * 0.12), duration: 1 },
      0
    );
  });

  return ScrollTrigger.create({
    trigger: section,
    start: 'top bottom',
    end: 'bottom top',
    scrub: 0.5,
    animation: tl,
    invalidateOnRefresh: true,
  });
}
