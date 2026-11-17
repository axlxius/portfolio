/**
 * The motion preference: the OS setting, unless the visitor has used the
 * Motion switch in the header, in which case their choice wins and persists.
 *
 * Everything that moves reads `motion.reduced` when it runs rather than once
 * at start-up, so the switch takes effect without a reload.
 */
const KEY = 'portfolio-motion';
const media = window.matchMedia('(prefers-reduced-motion: reduce)');

type Listener = (reduced: boolean) => void;
const listeners = new Set<Listener>();

function read(): 'reduce' | 'full' | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'reduce' || v === 'full' ? v : null;
  } catch {
    return null;
  }
}

let choice = read();
let reduced = choice ? choice === 'reduce' : media.matches;

function apply(next: boolean) {
  if (next === reduced) return;
  reduced = next;
  document.documentElement.dataset.motion = reduced ? 'reduce' : 'full';
  listeners.forEach((fn) => fn(reduced));
}

// Follow the OS only while the visitor has not made an explicit choice.
media.addEventListener('change', () => {
  if (!choice) apply(media.matches);
});

export const motion = {
  get reduced() {
    return reduced;
  },
  toggle() {
    choice = reduced ? 'full' : 'reduce';
    try {
      localStorage.setItem(KEY, choice);
    } catch {
      // The choice simply will not persist; the switch still works this visit.
    }
    apply(choice === 'reduce');
  },
  onChange(fn: Listener) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
