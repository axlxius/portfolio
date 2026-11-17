import { el } from '../core/env.ts';

let node: HTMLElement | null = null;
let timer = 0;

/** A short confirmation at the bottom of the screen, announced politely. */
export function toast(message: string, ms = 2400) {
  if (!node) {
    node = el('div', 'toast', { role: 'status', 'aria-live': 'polite' });
    document.body.append(node);
  }
  node.textContent = message;
  // Next frame, so a repeat message still re-triggers the transition.
  requestAnimationFrame(() => node?.classList.add('is-open'));
  window.clearTimeout(timer);
  timer = window.setTimeout(() => node?.classList.remove('is-open'), ms);
}
