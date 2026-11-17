import { sceneRef } from '../core/refs.ts';
import { toast } from './toast.ts';

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

/**
 * Small rewards for the curious:
 *
 *  - D toggles the theme;
 *  - typing "sg" (or the Konami code) makes the cloud briefly take the shape
 *    of the island;
 *  - a click sends a ripple through the cloud, a double-click a larger one.
 */
export function createEasterEggs(toggleTheme: () => void, isBusy: () => boolean) {
  let typed = '';
  let typedAt = 0;
  let konami = 0;
  let islandTimer = 0;

  function island() {
    if (isBusy()) return;
    const scene = sceneRef.current;
    if (!scene) return;
    scene.setTakeover('island');
    toast('1.3521° N, 103.8198° E', 3200);
    window.clearTimeout(islandTimer);
    islandTimer = window.setTimeout(() => !isBusy() && scene.setTakeover(null), 3400);
  }

  window.addEventListener('keydown', (event) => {
    const target = event.target as HTMLElement | null;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (target?.closest('input, textarea, select, [contenteditable]')) return;

    konami = event.key === KONAMI[konami] ? konami + 1 : event.key === KONAMI[0] ? 1 : 0;
    if (konami === KONAMI.length) {
      konami = 0;
      island();
      return;
    }

    if (event.key.length !== 1) return;
    const key = event.key.toLowerCase();
    const now = performance.now();
    typed = now - typedAt < 900 ? typed + key : key;
    typedAt = now;

    if (typed.endsWith('sg')) {
      typed = '';
      island();
    } else if (key === 'd' && !isBusy()) {
      toggleTheme();
    }
  });

  window.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    sceneRef.current?.shock(event.clientX, event.clientY, 0.55);
  });
  window.addEventListener('dblclick', (event) => {
    sceneRef.current?.shock(event.clientX, event.clientY, 1.5);
  });
}
