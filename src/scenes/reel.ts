import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

import { EASE } from '../core/ease.ts';
import { el, qs, qsa } from '../core/env.ts';
import type { SmoothScroll } from '../scroll/smooth.ts';
import type { Overlay } from '../ui/overlay.ts';

gsap.registerPlugin(ScrollTrigger, SplitText);

const INTRO = 0.7; // beats before the first card, while the cloud is the vase
const OUTRO = 0.5; // beats after the last card, while the cloud lets go

interface ReelOptions {
  overlay: Overlay;
  scroll: SmoothScroll;
  /** The project on screen, or -1 between cards. */
  onProject: (index: number) => void;
}

/**
 * Scene 2, the work reel. Pinned and scrubbed: one beat per project. Each
 * title card's letters rise into place, its line and year follow, it holds,
 * and it lifts away as the next arrives. The cloud draws each project's
 * figure for as long as its card is up.
 */
export function createReel({ overlay, scroll, onProject }: ReelOptions): ScrollTrigger | null {
  const section = qs('#work');
  const items = qsa('[data-reel]');
  const count = qs('[data-reel-count]');
  if (!section || items.length === 0) return null;

  const n = items.length;
  const total = INTRO + n + OUTRO;
  const cards = items.map((item) => {
    const title = item.querySelector<HTMLElement>('[data-title]')!;
    const split = SplitText.create(title, { type: 'words,chars', mask: 'chars', charsClass: 'char', wordsClass: 'word' });
    return {
      item,
      link: item.querySelector<HTMLElement>('[data-project]')!,
      chars: split.chars as HTMLElement[],
      rest: [item.querySelector('.reel-note'), item.querySelector('.reel-meta')].filter(Boolean) as HTMLElement[],
    };
  });

  // Every card starts below its mask.
  cards.forEach((c) => {
    gsap.set(c.chars, { yPercent: 170 });
    gsap.set(c.rest, { opacity: 0, y: 24 });
  });

  const tl = gsap.timeline({ defaults: { ease: 'none' } });
  cards.forEach((c, i) => {
    const t = INTRO + i;
    tl.to(c.chars, { yPercent: 0, duration: 0.3, ease: 'power3.out', stagger: { amount: 0.12 } }, t)
      .to(c.rest, { opacity: 1, y: 0, duration: 0.24, ease: 'power2.out', stagger: 0.05 }, t + 0.14)
      .to(c.rest, { opacity: 0, y: -16, duration: 0.18, ease: 'power2.in' }, t + 0.74)
      .to(c.chars, { yPercent: -170, duration: 0.24, ease: 'power3.in', stagger: { amount: 0.08 } }, t + 0.76);
  });
  tl.to({}, { duration: OUTRO }, INTRO + n);

  let live = -2;
  function setLive(index: number) {
    if (index === live) return;
    const down = index > live;
    live = index;
    cards.forEach((c, i) => c.item.classList.toggle('is-live', i === index));
    onProject(index);

    if (count) {
      const label = Object.assign(el('span'), { textContent: index < 0 ? '00' : String(index + 1).padStart(2, '0') });
      const old = count.lastElementChild;
      gsap.killTweensOf(count);
      if (!old) return void count.replaceChildren(label);
      count.replaceChildren(...(down ? [old, label] : [label, old]));
      gsap.fromTo(
        count,
        { yPercent: down ? 0 : -50 },
        {
          yPercent: down ? -50 : 0,
          duration: 0.5,
          ease: EASE,
          onComplete: () => {
            count.replaceChildren(label);
            gsap.set(count, { yPercent: 0 });
          },
        }
      );
    }
  }

  const trigger = ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: `+=${n * 95 + 110}%`,
    pin: true,
    scrub: true,
    animation: tl,
    onUpdate: (self) => {
      const beat = self.progress * total - INTRO;
      setLive(beat >= 0 && beat < n ? Math.floor(beat) : -1);
    },
    onLeave: () => setLive(-1),
    onLeaveBack: () => setLive(-1),
  });

  // Keyboard: a focused card brings its beat on screen.
  cards.forEach((c, i) => {
    c.link.addEventListener('focus', () => {
      if (!c.link.matches(':focus-visible')) return;
      const at = trigger.start + ((INTRO + i + 0.45) / total) * (trigger.end - trigger.start);
      scroll.scrollTo(at, { duration: 0.8 });
    });
    c.link.addEventListener('click', (event) => {
      // Let the browser handle "open in new tab" and friends.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      overlay.open(i, c.link);
    });
    c.link.setAttribute('aria-haspopup', 'dialog');
  });

  return trigger;
}
