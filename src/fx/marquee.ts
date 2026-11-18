import { qs, qsa } from '../core/env.ts';
import { motion } from '../core/motion.ts';

const TICKER_SPEED = 70; // px per second
const BAND_SPEED = 90;

/**
 * The ticker along the top and the toolkit bands. Both are CSS animations
 * (src/styles/home.css) on content repeated until it covers the screen; this
 * makes the copies, sets each one's duration from its length so they all move
 * at a steady speed, and lets the bands feel the scroll: they speed up while
 * the page moves and run backwards while it scrolls up.
 *
 * Copies are aria-hidden, so a screen reader meets each item once. With
 * reduced motion nothing is copied and the bands are plain wrapped lists.
 */
export function createMarquees(velocity: () => number) {
  const ticker = qs('[data-ticker]');
  const run = ticker ? qs('.ticker-run', ticker) : null;
  const bands = qsa('[data-band]');
  const originals = run ? Array.from(run.children) : [];

  function setTicker() {
    if (!ticker || !run) return;
    run.replaceChildren(...originals);
    ticker.classList.remove('is-running');
    if (motion.reduced) return;
    // One set at least as wide as the screen, then the same again so a
    // shift of half the run lands exactly where it started.
    const one = run.scrollWidth || 1;
    const sets = Math.max(1, Math.ceil(window.innerWidth / one));
    const copy = () => originals.map((o) => o.cloneNode(true));
    for (let i = 1; i < sets * 2; i++) run.append(...copy());
    ticker.style.setProperty('--dur', `${((one * sets) / TICKER_SPEED).toFixed(1)}s`);
    ticker.classList.add('is-running');
  }

  function setBand(band: HTMLElement) {
    const track = qs('.band-track', band);
    const list = track?.firstElementChild as HTMLElement | null;
    if (!track || !list) return;
    track.replaceChildren(list);
    band.classList.remove('is-running');
    if (motion.reduced) return;
    band.classList.add('is-running');
    const width = list.scrollWidth || 1;
    const count = Math.ceil(track.clientWidth / width) + 1;
    for (let i = 0; i < count; i++) {
      const copy = list.cloneNode(true) as HTMLElement;
      copy.setAttribute('aria-hidden', 'true');
      track.append(copy);
    }
    band.style.setProperty('--dur', `${(width / BAND_SPEED).toFixed(1)}s`);
  }

  function setAll() {
    setTicker();
    bands.forEach(setBand);
  }

  setAll();
  document.fonts?.ready.then(setAll).catch(() => {});
  motion.onChange(setAll);
  let timer = 0;
  let lastWidth = window.innerWidth;
  window.addEventListener('resize', () => {
    if (window.innerWidth === lastWidth) return; // phone toolbars resize height only
    lastWidth = window.innerWidth;
    window.clearTimeout(timer);
    timer = window.setTimeout(setAll, 200);
  });

  // The bands answer the scroll: faster while it moves, backwards going up.
  let rate = 1;
  let heading = 1;
  return {
    /** Call once per frame. */
    update() {
      if (motion.reduced || bands.length === 0) return;
      const v = velocity();
      if (Math.abs(v) > 0.5) heading = Math.sign(v);
      const target = heading * (1 + Math.min(Math.abs(v) * 0.35, 6));
      rate += (target - rate) * 0.12;
      if (Math.abs(rate - target) < 0.001) rate = target;
      bands.forEach((band) => {
        band.getAnimations({ subtree: true }).forEach((a) => {
          a.playbackRate = rate;
        });
      });
    },
  };
}
