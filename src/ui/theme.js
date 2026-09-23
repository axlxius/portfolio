const STORAGE_KEY = 'portfolio-theme';

/**
 * Light and dark are a literal inversion of one ink/paper pair. The WebGL ink
 * colour is swapped alongside the CSS so the 3D layer inverts with the page.
 */
export function createTheme({ onChange }) {
  const root = document.documentElement;
  const button = document.querySelector('[data-theme-toggle]');
  const label = button?.querySelector('[data-theme-label]');
  const media = window.matchMedia('(prefers-color-scheme: dark)');

  let stored = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private mode, blocked cookies). Not fatal.
  }

  let mode = stored === 'light' || stored === 'dark' ? stored : null;

  function resolved() {
    if (mode) return mode;
    return media.matches ? 'dark' : 'light';
  }

  function apply() {
    const next = resolved();
    root.dataset.theme = next;
    if (button) {
      button.setAttribute('aria-pressed', String(next === 'dark'));
      // The control says what it switches to, not what is active.
      button.setAttribute(
        'aria-label',
        next === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
      );
      if (label) label.textContent = next === 'dark' ? 'Light' : 'Dark';
    }
    onChange?.(next, next === 'dark' ? '#ffffff' : '#000000');
  }

  button?.addEventListener('click', () => {
    mode = resolved() === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Preference simply will not persist; the toggle still works this visit.
    }
    apply();
  });

  // Follow the OS only while the visitor has not made an explicit choice.
  media.addEventListener('change', () => {
    if (!mode) apply();
  });

  apply();
  return { resolved, apply };
}
