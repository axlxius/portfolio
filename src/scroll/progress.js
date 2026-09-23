/**
 * Maps scroll position onto the morph timeline.
 *
 * Sections have very different heights, so a plain scrollTop/scrollHeight ratio
 * would rush through short sections and stall on tall ones. Instead each
 * section contributes one integer stop on the timeline, anchored at the scroll
 * position where that section sits under the middle of the viewport. Scrolling
 * between two sections interpolates between their stops, so state N is always
 * fully formed exactly when section N is centred.
 */
export function createSectionProgress(sections) {
  let anchors = [];

  function measure() {
    const viewportMid = window.innerHeight / 2;
    anchors = sections.map((el) => {
      const rect = el.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      // Anchor on the section's centre, but never past what can be scrolled to.
      const centre = top + rect.height / 2;
      return centre - viewportMid;
    });

    // Guarantee a strictly increasing track so the search below is well defined.
    for (let i = 1; i < anchors.length; i++) {
      if (anchors[i] <= anchors[i - 1]) anchors[i] = anchors[i - 1] + 1;
    }
  }

  function valueAt(scrollY) {
    if (anchors.length === 0) return 0;
    if (scrollY <= anchors[0]) return 0;

    const last = anchors.length - 1;
    if (scrollY >= anchors[last]) return last;

    for (let i = 0; i < last; i++) {
      const a = anchors[i];
      const b = anchors[i + 1];
      if (scrollY < b) return i + (scrollY - a) / (b - a);
    }
    return last;
  }

  measure();

  // Fonts and images shift layout after first paint; re-measure when they land.
  window.addEventListener('resize', measure, { passive: true });
  window.addEventListener('load', measure);
  if (document.fonts?.ready) document.fonts.ready.then(measure);

  return { valueAt, measure };
}
