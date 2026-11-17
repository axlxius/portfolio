/**
 * Maps scroll position onto the morph timeline.
 *
 * Sections have very different heights, so a plain scrollTop/scrollHeight ratio
 * would rush through short sections and stall on tall ones. Instead each
 * state gets one stop, anchored at the scroll offset where its section sits
 * under the middle of the viewport. Scrolling between two stops interpolates,
 * so state N is fully formed exactly when section N is centred.
 *
 * The last section owns two states: the tangled form as it arrives, and the
 * single line it resolves into at the very bottom of the page.
 */
export function createSectionProgress(sections: HTMLElement[]) {
  let anchors: number[] = [];

  function measure() {
    const vh = window.innerHeight;
    const max = Math.max(1, document.documentElement.scrollHeight - vh);

    anchors = sections.map((el, i) => {
      const rect = el.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      if (i === sections.length - 1) return top - vh * 0.42;
      return top + rect.height / 2 - vh / 2;
    });
    anchors[0] = 0;
    anchors.push(max);

    // Guarantee a strictly increasing track so the search below is well defined.
    for (let i = 1; i < anchors.length; i++) {
      if (anchors[i] <= anchors[i - 1]) anchors[i] = anchors[i - 1] + 1;
    }
  }

  function valueAt(scrollY: number): number {
    const last = anchors.length - 1;
    if (last < 0 || scrollY <= anchors[0]) return 0;
    if (scrollY >= anchors[last]) return last;
    for (let i = 0; i < last; i++) {
      if (scrollY < anchors[i + 1]) {
        return i + (scrollY - anchors[i]) / (anchors[i + 1] - anchors[i]);
      }
    }
    return last;
  }

  measure();
  // Fonts and split text shift layout after first paint; re-measure when they land.
  window.addEventListener('resize', measure, { passive: true });
  window.addEventListener('load', measure);
  document.fonts?.ready.then(measure);
  new ResizeObserver(measure).observe(document.body);

  return { valueAt, measure };
}
