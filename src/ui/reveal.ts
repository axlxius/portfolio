import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

import { EASE } from '../core/ease.ts';
import { qsa } from '../core/env.ts';
import { motion } from '../core/motion.ts';

gsap.registerPlugin(ScrollTrigger, SplitText);

const SELECTOR = '[data-reveal], .rule, [data-fade], [data-lines], [data-hero-lead], [data-hero-name]';

/** Show everything at once, with no animation. Used for reduced motion. */
const triggers: ScrollTrigger[] = [];

export function revealAll() {
  triggers.splice(0).forEach((st) => st.kill());
  ScrollTrigger.getAll().forEach((st) => {
    if (String(st.vars.id ?? '').startsWith('reveal')) st.kill();
  });
  qsa(SELECTOR).forEach((node) => {
    gsap.killTweensOf(node);
    node.classList.add('is-in');
    gsap.set(node, { clearProps: 'opacity,transform,fontStretch' });
  });
  qsa('.title-inner, .line').forEach((node) => {
    gsap.killTweensOf(node);
    gsap.set(node, { clearProps: 'transform,fontStretch' });
  });
}

/**
 * Scroll-triggered reveals. Each kind of element gets one move, once:
 *
 *  - section headings rise out of a clipping line while widening from
 *    condensed to expanded;
 *  - hairlines draw in from the left;
 *  - paragraphs marked [data-lines] rise line by line;
 *  - everything marked [data-fade] fades up, staggered within its group.
 *
 * The hero is left to the intro sequence, which choreographs it itself.
 */
export function createReveals() {
  if (motion.reduced) {
    revealAll();
    return;
  }

  // Headings.
  qsa('[data-reveal]').forEach((heading) => {
    const inner = heading.querySelector<HTMLElement>('.title-inner');
    if (!inner) return;
    gsap.fromTo(
      inner,
      { yPercent: 108, fontStretch: '78%' },
      {
        yPercent: 0,
        fontStretch: '125%',
        duration: 1.25,
        ease: EASE,
        scrollTrigger: { id: 'reveal-title', trigger: heading, start: 'top 88%', once: true },
        onStart: () => heading.classList.add('is-in'),
        onComplete: () => gsap.set(inner, { clearProps: 'transform,fontStretch' }),
      }
    );
  });

  // Hairlines.
  const ruleBatch = ScrollTrigger.batch('.rule', {
    start: 'top 98%',
    once: true,
    onEnter: (batch) => {
      gsap.fromTo(
        batch,
        { scaleX: 0 },
        {
          scaleX: 1,
          duration: 1.3,
          ease: EASE,
          stagger: 0.07,
          onStart: () => batch.forEach((n) => (n as HTMLElement).classList.add('is-in')),
        }
      );
    },
  });

  // Fades, staggered within whatever enters together. The hero's own pieces
  // are left to the intro sequence.
  const fades = qsa('[data-fade]').filter((n) => !n.closest('#intro'));
  const fadeBatch = ScrollTrigger.batch(fades, {
    // Late enough that the footer still triggers at the very end of the page.
    start: 'top 97%',
    once: true,
    onEnter: (batch) => {
      gsap.fromTo(
        batch,
        { opacity: 0, y: 18 },
        {
          opacity: 1,
          y: 0,
          duration: 0.9,
          ease: EASE,
          stagger: 0.06,
          onComplete: () => {
            batch.forEach((n) => (n as HTMLElement).classList.add('is-in'));
            gsap.set(batch, { clearProps: 'opacity,transform' });
          },
        }
      );
    },
  });

  triggers.push(...ruleBatch, ...fadeBatch);

  // Line-by-line text. Re-split on resize is handled by autoSplit.
  qsa('[data-lines]').forEach((block) => {
    SplitText.create(block, {
      type: 'lines',
      mask: 'lines',
      linesClass: 'line',
      autoSplit: true,
      onSplit(self) {
        block.classList.add('is-in');
        return gsap.from(self.lines, {
          yPercent: 105,
          duration: 0.95,
          ease: EASE,
          stagger: 0.07,
          scrollTrigger: { id: 'reveal-lines', trigger: block, start: 'top 92%', once: true },
        });
      },
    });
  });
}
