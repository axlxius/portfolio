import gsap from 'gsap';

import { LINKS } from '../data/content.ts';
import { EASE } from '../core/ease.ts';
import { finePointer, qs } from '../core/env.ts';
import { motion } from '../core/motion.ts';
import { sceneRef } from '../core/refs.ts';
import type { SmoothScroll } from '../scroll/smooth.ts';
import { toast } from '../ui/toast.ts';

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';

/** Letters cycle through random glyphs and resolve left to right. */
function scramble(node: HTMLElement) {
  const text = node.dataset.text ?? node.textContent ?? '';
  node.dataset.text = text;
  node.setAttribute('aria-label', text);
  const state = { k: 0 };
  gsap.killTweensOf(state);
  gsap.to(state, {
    k: 1,
    duration: 0.9,
    ease: 'power2.out',
    onUpdate: () => {
      const settled = Math.floor(state.k * text.length);
      node.textContent = text
        .split('')
        .map((ch, i) => {
          if (i < settled || ch === ' ') return ch;
          const pool = ch === ch.toUpperCase() ? UPPER : LOWER;
          return pool[Math.floor(Math.random() * pool.length)];
        })
        .join('');
    },
    onComplete: () => (node.textContent = text),
  });
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers and insecure contexts: fall back to a hidden field.
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.append(field);
    field.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    field.remove();
    return ok;
  }
}

export function createContact(scroll: SmoothScroll) {
  // Headline: scrambles when the pointer arrives.
  const headline = qs('[data-scramble] .title-inner');
  if (headline && finePointer) {
    headline.parentElement?.addEventListener('pointerenter', () => {
      if (!motion.reduced && headline.parentElement?.classList.contains('is-in')) scramble(headline);
    });
  }

  // Email: the address is copied as well as opened, with a ripple through the
  // cloud from the button. If copying is refused, the toast shows the address.
  const email = qs<HTMLAnchorElement>('.contact-link[data-kind="email"]');
  email?.addEventListener('click', async () => {
    const r = email.getBoundingClientRect();
    sceneRef.current?.shock(r.left + r.width / 2, r.top + r.height / 2, 1.4);
    const ok = await copy(LINKS.email);
    toast(ok ? 'Email address copied' : LINKS.email, ok ? 2400 : 6000);
  });

  // Singapore time, live.
  const clock = qs('[data-clock]');
  if (clock) {
    const format = new Intl.DateTimeFormat('en-SG', {
      timeZone: 'Asia/Singapore',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const paint = () => (clock.textContent = `${format.format(new Date())} SGT`);
    paint();
    window.setInterval(paint, 1000);
  }

  // Back to top: a hairline shoots up from the link as the page launches.
  const top = qs<HTMLAnchorElement>('[data-to-top]');
  const line = top?.querySelector<HTMLElement>('.to-top-line');
  top?.addEventListener('click', (event) => {
    event.preventDefault();
    if (line && !motion.reduced) {
      gsap.fromTo(
        line,
        { scaleY: 0, opacity: 1, transformOrigin: 'bottom center' },
        { scaleY: 1, duration: 0.5, ease: EASE, onComplete: () => void gsap.to(line, { opacity: 0, duration: 0.5 }) }
      );
    }
    scroll.scrollTo(0, { duration: 1.8, immediate: motion.reduced });
    qs<HTMLElement>('.wordmark')?.focus({ preventScroll: true });
  });
}
