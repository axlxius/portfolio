import Lenis from 'lenis';

/**
 * Smooth scrolling, wired into a single rAF loop shared with the 3D scene.
 * Returns null when motion is reduced so the browser's native scroll is used
 * untouched.
 */
export function createSmoothScroll({ reducedMotion }) {
  if (reducedMotion) return null;

  const lenis = new Lenis({
    duration: 1.1,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    // Native momentum on touch feels better than a JS-driven substitute.
    syncTouch: false,
  });

  // In-page anchors route through Lenis so jumps are eased, not instant.
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (event) => {
      const id = anchor.getAttribute('href');
      if (!id || id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;
      event.preventDefault();
      lenis.scrollTo(target, { offset: 0 });
    });
  });

  return lenis;
}
