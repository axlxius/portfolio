import gsap from 'gsap';

import { damp, el, finePointer } from '../core/env.ts';
import { motion } from '../core/motion.ts';

export type CursorState = 'default' | 'link' | 'view' | 'drag' | 'held' | 'text';

const LABELS: Partial<Record<CursorState, string>> = { link: '+', view: 'View', drag: 'Drag' };

const INTERACTIVE = 'a, button, [role="button"], summary, label, input, select, textarea';
const COPY = 'p, li, dd, dt, h3, blockquote';

/**
 * A small dot that tracks the pointer and a ring that lags behind it. The
 * ring takes a context state from whatever is under it: "View" over project
 * rows, "Drag" over the stack words, a plus over links, an I-beam over copy.
 *
 * Only for a real mouse, and never with reduced motion: in both cases the
 * native cursor is left alone.
 */
export function createCursor() {
  if (!finePointer) return null;

  const root = el('div', 'cursor', { 'aria-hidden': 'true' });
  const dot = el('div', 'cursor-dot');
  const ring = el('div', 'cursor-ring');
  const shape = el('div', 'cursor-shape');
  const label = el('span', 'cursor-label');
  ring.append(shape, label);
  root.append(ring, dot);
  document.body.append(root);

  const pos = { x: -100, y: -100 };
  const lag = { x: -100, y: -100 };
  let state: CursorState = 'default';
  let override: CursorState | null = null;
  let seen = false;

  function paint() {
    const s = override ?? state;
    root.dataset.state = s;
    label.textContent = LABELS[s] ?? '';
  }

  function setEnabled(on: boolean) {
    document.documentElement.classList.toggle('has-cursor', on);
    root.style.display = on ? '' : 'none';
  }

  function stateFor(target: Element | null): CursorState {
    if (!target) return 'default';
    const tagged = target.closest<HTMLElement>('[data-cursor]');
    if (tagged) return tagged.dataset.cursor as CursorState;
    if (target.closest(INTERACTIVE)) return 'link';
    if (target.closest(COPY)) return 'text';
    return 'default';
  }

  window.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType !== 'mouse') return;
      pos.x = event.clientX;
      pos.y = event.clientY;
      if (!seen) {
        seen = true;
        lag.x = pos.x;
        lag.y = pos.y;
        root.classList.add('is-visible');
      }
      dot.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
    },
    { passive: true }
  );

  document.addEventListener(
    'pointerover',
    (event) => {
      const next = stateFor(event.target as Element | null);
      if (next !== state) {
        state = next;
        paint();
      }
    },
    { passive: true }
  );

  window.addEventListener('pointerdown', () => root.classList.add('is-down'), { passive: true });
  window.addEventListener('pointerup', () => root.classList.remove('is-down'), { passive: true });
  document.documentElement.addEventListener('pointerleave', () => root.classList.remove('is-visible'));
  document.documentElement.addEventListener('pointerenter', () => seen && root.classList.add('is-visible'));

  gsap.ticker.add((_time, deltaMs) => {
    if (motion.reduced || !seen) return;
    const k = damp(16, Math.min(deltaMs / 1000, 0.05));
    lag.x += (pos.x - lag.x) * k;
    lag.y += (pos.y - lag.y) * k;
    ring.style.transform = `translate3d(${lag.x}px, ${lag.y}px, 0)`;
  });

  setEnabled(!motion.reduced);
  motion.onChange((reduced) => setEnabled(!reduced));
  paint();

  return {
    /** Force a state (used while a word is being dragged). Null releases it. */
    setOverride(next: CursorState | null) {
      override = next;
      paint();
    },
  };
}

export type Cursor = NonNullable<ReturnType<typeof createCursor>>;
