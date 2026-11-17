import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { qs, qsa } from '../core/env.ts';
import { NARROW, WIDE } from '../core/type.ts';
import type { Dot, Wipes } from './wipes.ts';
import { measureDot } from './wipes.ts';

gsap.registerPlugin(ScrollTrigger);

interface TitleOptions {
  chars: HTMLElement[];
  wipes: Wipes;
  /** Camera push into the cloud, 1 = rest. */
  onZoom: (factor: number) => void;
}

/**
 * Scene 1, the title card. Pinned and scrubbed:
 *
 *   0.00  the supporting lines lift away (their wrappers: the intro
 *         sequence owns the lines themselves)
 *   0.05  the name pulls apart across the screen, each letter condensing to
 *         its narrowest width and thickening to a heavy weight
 *   0.48  every letter but the "i" drops out of sight, outermost first,
 *         and the "i" slides to the centre
 *   0.66  the dot of the "i" grows into a circle that fills the screen:
 *         the page is in negative for the next scene
 *
 * The camera pushes into the cloud through the wipe.
 */
export function createTitleScene({ chars, wipes, onZoom }: TitleOptions): ScrollTrigger | null {
  const section = qs('#intro');
  const stage = qs('#intro .title-stage');
  const fades = qsa('#intro [data-title-fade]');
  const iChar = chars.find((c) => c.textContent === 'i');
  if (!section || !stage || !iChar || chars.length === 0) return null;

  const masks = chars.map((c) => c.parentElement as HTMLElement);
  const iMask = iChar.parentElement as HTMLElement;
  const others = chars.filter((c) => c !== iChar);
  const iIndex = chars.indexOf(iChar);

  const name = chars[0].closest<HTMLElement>('[data-hero-name]')!;
  const condensed = { fontStretch: NARROW, fontWeight: 840 };

  // Where each letter would sit once condensed, measured on an invisible
  // copy of the name, so the spread can place every letter exactly: the
  // first and last at the screen's edges, the rest evenly between.
  let offsets: number[] = [];
  function measureSpread() {
    const copy = document.createElement('div');
    copy.className = name.className;
    copy.setAttribute('aria-hidden', 'true');
    copy.style.cssText = `position:absolute;left:${name.offsetLeft}px;top:0;visibility:hidden;white-space:nowrap;pointer-events:none`;
    const spans: HTMLSpanElement[] = [];
    for (const ch of name.textContent ?? '') {
      if (ch === ' ') {
        copy.append(' ');
        continue;
      }
      const span = document.createElement('span');
      span.textContent = ch;
      span.style.cssText = `display:inline-block;font-stretch:${condensed.fontStretch};font-weight:${condensed.fontWeight}`;
      copy.append(span);
      spans.push(span);
    }
    name.parentElement!.append(copy);
    const centres = spans.map((sp) => {
      const r = sp.getBoundingClientRect();
      return { c: r.left + r.width / 2, w: r.width };
    });
    copy.remove();

    const gutter = parseFloat(getComputedStyle(stage!).paddingLeft) || 24;
    const first = gutter + centres[0].w / 2;
    const last = window.innerWidth - gutter - centres[centres.length - 1].w / 2;
    offsets = centres.map((c, i) => first + ((last - first) * i) / (centres.length - 1) - c.c);
  }

  let dot: Dot | null = null;
  const state = { w: 0, zoom: 1 };

  const tl = gsap.timeline({
    defaults: { ease: 'none', immediateRender: false },
    scrollTrigger: {
      trigger: section,
      start: 'top top',
      end: '+=190%',
      pin: true,
      scrub: true,
      invalidateOnRefresh: true,
      onRefresh: () => (dot = null),
    },
  });

  tl.fromTo(fades, { opacity: 1, y: 0 }, { opacity: 0, y: -36, duration: 0.16, stagger: 0.02, ease: 'power1.in' }, 0)
    // Pull apart.
    .fromTo(
      masks,
      { x: 0 },
      {
        x: (i: number) => {
          if (i === 0) measureSpread();
          return offsets[i] ?? 0;
        },
        duration: 0.42,
        ease: 'power2.inOut',
      },
      0.05
    )
    // Condense and thicken.
    .fromTo(
      chars,
      { fontStretch: WIDE, fontWeight: 200 },
      { ...condensed, duration: 0.36, ease: 'power1.inOut', stagger: { each: 0.008, from: 'center' } },
      0.1
    )
    // A wave runs through the letters as they travel, then settles.
    .fromTo(
      masks,
      { y: 0 },
      { y: (i: number) => Math.sin(i * 1.15) * window.innerHeight * 0.07, duration: 0.2, ease: 'sine.inOut' },
      0.14
    )
    .to(masks, { y: 0, duration: 0.16, ease: 'sine.inOut' }, 0.34)
    // Everything but the "i" drops away, outermost letters first.
    .fromTo(
      others,
      { yPercent: 0 },
      {
        yPercent: 118,
        duration: 0.12,
        ease: 'power3.in',
        stagger: (i: number) => {
          const index = i >= iIndex ? i + 1 : i;
          return (chars.length - Math.abs(index - iIndex)) * 0.008;
        },
      },
      0.48
    )
    // The "i" takes the centre of the screen.
    .to(
      iMask,
      {
        x: () => {
          const r = iMask.getBoundingClientRect();
          const current = Number(gsap.getProperty(iMask, 'x')) || 0;
          return window.innerWidth / 2 - (r.left - current + r.width / 2);
        },
        duration: 0.14,
        ease: 'power3.inOut',
      },
      0.52
    )
    // The dot opens into the next scene.
    .fromTo(
      state,
      { w: 0, zoom: 1 },
      {
        w: 1,
        zoom: 0.6,
        duration: 0.34,
        ease: 'power1.in',
        onUpdate: () => {
          if (!dot && state.w > 0) dot = measureDot(iChar);
          wipes.setCircle(state.w, dot);
          onZoom(state.zoom);
        },
      },
      0.66
    )
    // Once the screen is covered the "i" would show again in negative.
    .fromTo(iChar, { opacity: 1 }, { opacity: 0, duration: 0.001 }, 0.999);

  return tl.scrollTrigger ?? null;
}
