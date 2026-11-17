import { motion } from '../core/motion.ts';

const KEY = 'portfolio-theme';

export type ThemeMode = 'light' | 'dark';
type Listener = (mode: ThemeMode, instant: boolean) => void;

/**
 * Light and dark are a literal inversion of one foreground/background pair.
 *
 * Switching opens the new theme as a circle from the toggle, using the View
 * Transitions API. Where that is missing, or motion is reduced, the colours
 * cross-fade instead (the scene eases its own ink; `instant` tells it which).
 */
export function createTheme(onChange: Listener) {
  const root = document.documentElement;
  const button = document.querySelector<HTMLButtonElement>('[data-theme-toggle]');
  const label = button?.querySelector<HTMLElement>('[data-theme-label]');
  const media = window.matchMedia('(prefers-color-scheme: dark)');

  let stored: string | null = null;
  try {
    stored = localStorage.getItem(KEY);
  } catch {
    // Storage can be unavailable (private mode, blocked cookies). Not fatal.
  }
  let choice: ThemeMode | null = stored === 'light' || stored === 'dark' ? stored : null;

  const resolved = (): ThemeMode => choice ?? (media.matches ? 'dark' : 'light');

  function paint(mode: ThemeMode, instant: boolean) {
    root.dataset.theme = mode;
    if (button) {
      button.setAttribute('aria-pressed', String(mode === 'dark'));
      // The control says what it switches to, not what is active.
      button.setAttribute('aria-label', mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
      if (label) label.textContent = mode === 'dark' ? 'Light' : 'Dark';
    }
    onChange(mode, instant);
  }

  function set(mode: ThemeMode) {
    if (mode === root.dataset.theme) return;

    const canWipe = !motion.reduced && typeof document.startViewTransition === 'function';
    if (!canWipe) {
      paint(mode, motion.reduced);
      return;
    }

    // The circle grows from the toggle to the farthest corner.
    const rect = button?.getBoundingClientRect();
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth;
    const y = rect ? rect.top + rect.height / 2 : 0;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

    root.dataset.vt = 'theme';
    const transition = document.startViewTransition(() => paint(mode, true));
    transition.ready
      .then(() => {
        root.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 950, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', pseudoElement: '::view-transition-new(root)' }
        );
      })
      .catch(() => {});
    // A second toggle mid-wipe skips this transition, which rejects these
    // promises. That is expected, so both outcomes just clean up.
    const done = () => {
      if (root.dataset.vt === 'theme') delete root.dataset.vt;
    };
    transition.finished.then(done, done);
  }

  function toggle() {
    choice = resolved() === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(KEY, choice);
    } catch {
      // Preference will not persist; the toggle still works this visit.
    }
    set(choice);
  }

  button?.addEventListener('click', toggle);

  // Follow the OS only while the visitor has not made an explicit choice.
  media.addEventListener('change', () => {
    if (!choice) set(resolved());
  });

  paint(resolved(), true);
  return { toggle, resolved };
}
