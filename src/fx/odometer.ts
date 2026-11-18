import gsap from 'gsap';

import { el } from '../core/env.ts';
import { motion } from '../core/motion.ts';

/**
 * Rolling digits, like a flap counter or a tape counter: each digit is a strip
 * of 0-9 that scrolls to its value instead of being swapped out. Any other
 * character (":" or "/") is fixed.
 *
 * The strip holds 0-9 and then a second 0, and each digit's position is a
 * number that only ever grows going forward (or shrinks going back). Drawing
 * that position modulo 10 means 9 rolls on into 0, and 0 rolls back into 9,
 * without ever spinning backwards through the whole strip.
 *
 * The strips read as "01234567890" to assistive tech, so a host must be
 * aria-hidden, as the HUD timecode and the reel counter already are.
 */

const CELLS = 11; // 0-9, then 0 again so 9 → 0 has somewhere to roll to

interface Digit {
  strip: HTMLElement;
  /** Unbounded position; the digit shown is pos mod 10. */
  state: { pos: number };
  /** Where the strip is heading; always equal to value mod 10. */
  target: number;
  value: number;
}

export interface OdometerOptions {
  /** Seconds for one digit to settle. */
  duration?: number;
}

export function createOdometer(host: HTMLElement, initial: string, { duration = 0.55 }: OdometerOptions = {}) {
  let digits: Array<Digit | null> = [];
  let text = '';

  const paint = (d: Digit) => {
    const at = ((d.state.pos % 10) + 10) % 10;
    d.strip.style.transform = `translate3d(0, ${(-(at * 100) / CELLS).toFixed(3)}%, 0)`;
  };

  function build(next: string) {
    text = next;
    digits = [];
    host.classList.add('odo');
    host.replaceChildren(
      ...[...next].map((ch) => {
        if (!/\d/.test(ch)) {
          digits.push(null);
          return Object.assign(el('span'), { className: 'odo-sep', textContent: ch });
        }
        const cell = el('span');
        cell.className = 'odo-digit';
        const strip = el('span');
        strip.className = 'odo-strip';
        strip.append(...[...'01234567890'].map((n) => Object.assign(el('span'), { textContent: n })));
        cell.append(strip);
        const d: Digit = { strip, state: { pos: Number(ch) }, target: Number(ch), value: Number(ch) };
        digits.push(d);
        paint(d);
        return cell;
      })
    );
  }

  build(initial);

  return {
    get text() {
      return text;
    },
    /**
     * Show `next`. `direction` says which way time is running: forward rolls
     * digits up (9 into 0), back rolls them down. Without it each digit takes
     * the shorter way round.
     */
    set(next: string, direction: 1 | -1 | 0 = 0) {
      if (next === text) return;
      // A different shape (more digits, separators moved) is rebuilt outright.
      if (next.length !== text.length || [...next].some((ch, i) => /\d/.test(ch) !== (digits[i] !== null))) {
        build(next);
        return;
      }
      text = next;
      [...next].forEach((ch, i) => {
        const d = digits[i];
        if (!d) return;
        const v = Number(ch);
        if (v === d.value) return;
        const up = (v - d.value + 10) % 10;
        const down = up - 10;
        const step = direction > 0 ? up : direction < 0 ? down : up <= 5 ? up : down;
        d.value = v;
        // Aim from the last target, not from where the strip is now, so fast
        // changes keep rolling on from wherever it has got to.
        d.target += step;
        const to = d.target;
        if (motion.reduced) {
          gsap.killTweensOf(d.state);
          d.state.pos = to;
          paint(d);
          return;
        }
        gsap.to(d.state, {
          pos: to,
          duration,
          ease: 'power3.out',
          overwrite: true,
          onUpdate: () => paint(d),
        });
      });
    },
  };
}

export type Odometer = ReturnType<typeof createOdometer>;
