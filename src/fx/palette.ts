import { motion } from '../core/motion.ts';

/** Keep in step with the palettes in src/styles/base.css. */
export const PALETTES = {
  cream: { name: 'Cream', bg: '#fff0de' },
  lilac: { name: 'Lilac', bg: '#b8a3ff' },
  night: { name: 'Night', bg: '#170a03' },
} as const;

export type PaletteId = keyof typeof PALETTES;

const KEY = 'portfolio-palette';
const ORDER = Object.keys(PALETTES) as PaletteId[];

const isPalette = (v: unknown): v is PaletteId => typeof v === 'string' && v in PALETTES;

/**
 * The Colour button cycles the palettes. The new one floods out from the
 * button as a circle (View Transitions); without that, or with reduced
 * motion, it simply changes. The choice is remembered. Until the visitor
 * picks, the page follows the device: Night when it is in dark mode.
 *
 * The pre-paint script in src/markup/page.ts sets the first palette, so the
 * page never flashes the wrong colours.
 */
export function createPalette() {
  const root = document.documentElement;
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-palette-toggle]'));
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  const media = window.matchMedia('(prefers-color-scheme: dark)');

  let chosen = false;
  try {
    chosen = isPalette(localStorage.getItem(KEY));
  } catch {
    // Storage blocked: the button still works for this visit.
  }

  const current = (): PaletteId => (isPalette(root.dataset.palette) ? root.dataset.palette : 'cream');

  function paint(id: PaletteId) {
    root.dataset.palette = id;
    meta?.setAttribute('content', PALETTES[id].bg);
    const next = PALETTES[ORDER[(ORDER.indexOf(id) + 1) % ORDER.length]].name;
    buttons.forEach((b) => b.setAttribute('aria-label', `Colours: ${PALETTES[id].name}. Switch to ${next}`));
  }

  function set(id: PaletteId, from?: HTMLElement) {
    if (id === current()) return;
    if (motion.reduced || typeof document.startViewTransition !== 'function') {
      paint(id);
      return;
    }
    const r = from?.getBoundingClientRect();
    const x = r ? r.left + r.width / 2 : window.innerWidth;
    const y = r ? r.top + r.height / 2 : 0;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    root.dataset.vt = 'palette';
    const t = document.startViewTransition(() => paint(id));
    t.ready
      .then(() =>
        root.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 700, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', pseudoElement: '::view-transition-new(root)' }
        )
      )
      .catch(() => {});
    const done = () => {
      if (root.dataset.vt === 'palette') delete root.dataset.vt;
    };
    t.finished.then(done, done);
  }

  buttons.forEach((button) =>
    button.addEventListener('click', () => {
      const next = ORDER[(ORDER.indexOf(current()) + 1) % ORDER.length];
      chosen = true;
      try {
        localStorage.setItem(KEY, next);
      } catch {
        // Not remembered; still changes now.
      }
      set(next, button);
    })
  );

  media.addEventListener('change', () => {
    if (!chosen) set(media.matches ? 'night' : 'cream');
  });

  paint(current());
}
