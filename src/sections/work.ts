import { PROJECTS } from '../data/content.ts';
import { finePointer, qs, qsa } from '../core/env.ts';
import { motion } from '../core/motion.ts';
import { sceneRef } from '../core/refs.ts';
import type { Overlay } from '../ui/overlay.ts';
import type { Preview } from '../ui/preview.ts';

const DWELL = 240; // ms a row must stay active before the cloud reforms

/**
 * The work list. Activating a row (hover, keyboard focus, or simply being the
 * row in view on a touch screen) does three things, in rising order of
 * commitment: the row itself responds at once, its band of the vase lights,
 * and after a short dwell the whole cloud reforms into the project's figure.
 * The dwell keeps the cloud calm when the pointer is only passing through.
 */
export function createWork(overlay: Overlay, preview: Preview | null) {
  const list = qs('[data-work-list]');
  const rows = qsa('[data-project]');
  if (!list || rows.length === 0) return;

  let active = -1;
  let dwell = 0;

  function activate(next: number, withPreview: boolean) {
    if (next === active) return;
    active = next;
    window.clearTimeout(dwell);

    rows.forEach((row, i) => row.classList.toggle('is-active', i === next));
    list!.classList.toggle('has-active', next >= 0);

    const scene = sceneRef.current;
    if (next < 0) {
      scene?.setBand(null);
      scene?.setTakeover(null);
      preview?.hide();
      return;
    }

    const project = PROJECTS[next];
    scene?.setBand(next);
    if (withPreview && !motion.reduced) preview?.show(project, next);
    else preview?.hide();
    // On touch screens the cloud sits behind the list, so a full takeover
    // would fight the text. There the lit band is the whole response.
    if (!motion.reduced && finePointer) {
      dwell = window.setTimeout(() => sceneRef.current?.setTakeover(project.visual), DWELL);
    }
  }

  rows.forEach((row, i) => {
    row.setAttribute('aria-haspopup', 'dialog');

    if (finePointer) {
      row.addEventListener('pointerenter', (event) => event.pointerType === 'mouse' && activate(i, true));
    }
    row.addEventListener('focus', () => {
      // Keyboard focus gets the row and the cloud, but no pointer-bound card.
      if (row.matches(':focus-visible')) activate(i, false);
    });
    row.addEventListener('blur', () => {
      if (!list.matches(':hover')) activate(-1, false);
    });

    row.addEventListener('keydown', (event) => {
      const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
      if (!step) return;
      event.preventDefault();
      rows[(i + step + rows.length) % rows.length].focus();
    });

    row.addEventListener('click', (event) => {
      // Let the browser handle "open in new tab" and friends.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      activate(-1, false);
      overlay.open(i, row);
    });
  });

  if (finePointer) {
    list.addEventListener('pointerleave', () => {
      const focused = rows.findIndex((row) => row.matches(':focus-visible'));
      activate(focused, false);
    });
    return;
  }

  // Touch: the row nearest the middle of the screen is the active one.
  const pick = () => {
    if (overlay.isOpen) return;
    const mid = window.innerHeight / 2;
    const bounds = list.getBoundingClientRect();
    if (bounds.bottom < mid - 40 || bounds.top > mid + 40) {
      activate(-1, false);
      return;
    }
    let best = -1;
    let bestDistance = Infinity;
    rows.forEach((row, i) => {
      const r = row.getBoundingClientRect();
      const d = Math.abs(r.top + r.height / 2 - mid);
      if (d < bestDistance) {
        bestDistance = d;
        best = i;
      }
    });
    activate(best, false);
  };
  window.addEventListener('scroll', pick, { passive: true });
}
