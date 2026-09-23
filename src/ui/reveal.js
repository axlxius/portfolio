/**
 * One reveal, on section headings only, once each.
 *
 * Deliberately not applied to body copy or list rows: a page where every block
 * slides up on entry reads as an effect applied to a template. The heading
 * rising into its own frame is the single orchestrated moment per section.
 */
export function createReveals({ reducedMotion }) {
  const targets = document.querySelectorAll('[data-reveal]');

  if (reducedMotion || !('IntersectionObserver' in window)) {
    targets.forEach((el) => el.setAttribute('data-revealed', ''));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.setAttribute('data-revealed', '');
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: '0px 0px -18% 0px', threshold: 0.1 }
  );

  targets.forEach((el) => observer.observe(el));
}
