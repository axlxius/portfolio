/**
 * The showcase video's timeline: one source of truth shared by the capture
 * script (Node) and the compositor page (browser). Times are in seconds.
 *
 * Everything here follows the style lock in video/README.md. Change timings
 * here and both stages pick them up.
 */

export const FPS = 30;
export const DURATION = 50;
export const FRAMES = FPS * DURATION;
export const W = 1920;
export const H = 1080;

// --- Easing ----------------------------------------------------------------

/** cubic-bezier(x1, y1, x2, y2) solved for y at x, as CSS does it. */
export function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (u) => ((ax * u + bx) * u + cx) * u;
  const sy = (u) => ((ay * u + by) * u + cy) * u;
  const dx = (u) => (3 * ax * u + 2 * bx) * u + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let u = x;
    for (let i = 0; i < 8; i++) {
      const err = sx(u) - x;
      const d = dx(u);
      if (Math.abs(err) < 1e-6 || Math.abs(d) < 1e-6) break;
      u -= err / d;
    }
    // Bisection fallback keeps the solve monotone near flat tangents.
    if (Math.abs(sx(u) - x) > 1e-4) {
      let lo = 0, hi = 1;
      for (let i = 0; i < 30; i++) {
        u = (lo + hi) / 2;
        if (sx(u) < x) lo = u; else hi = u;
      }
    }
    return sy(u);
  };
}

/** The site's one curve: --ease in src/styles/base.css. */
export const ease = bezier(0.22, 1, 0.36, 1);

/** Lenis' curve from src/scroll/smooth.js. */
export const lenis = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : Math.min(1, 1.001 - Math.pow(2, -10 * u)));

export const clamp01 = (v) => Math.min(1, Math.max(0, v));
export const lerp = (a, b, k) => a + (b - a) * k;
export const span = (t, t0, t1) => clamp01((t - t0) / (t1 - t0));

// --- Main page: scroll moves -------------------------------------------------

/**
 * Sections are named; their scroll offsets are measured from the live DOM by
 * the capture script, so content edits on the site do not break the video.
 * `offset` nudges a stop (Stack's heading would otherwise sit under the header).
 */
export const STOPS = {
  intro: { section: 'intro', offset: 0 },
  work: { section: 'work', offset: 0 },
  experience: { section: 'experience', offset: 0 },
  stack: { section: 'stack', offset: -90 },
  contact: { section: 'contact', offset: 0 },
};

export const SCROLLS = [
  { t0: 7.0, t1: 9.5, from: 'intro', to: 'work' },
  { t0: 18.5, t1: 21.5, from: 'work', to: 'experience' }, // hero
  { t0: 26.5, t1: 29.0, from: 'experience', to: 'stack' },
  { t0: 34.0, t1: 36.5, from: 'stack', to: 'contact' },
];

/** Scroll position at time t, given measured stop offsets. */
export function scrollAt(t, stops) {
  let y = stops.intro;
  for (const s of SCROLLS) {
    if (t < s.t0) break;
    y = lerp(stops[s.from], stops[s.to], lenis(span(t, s.t0, s.t1)));
  }
  return y;
}

/** Sub-frame blur kicks in above this on-screen speed (px per frame, site scale). */
export const BLUR_SPEED = 40;
/** Sub-frames per blurred frame, spread over a 180-degree shutter. */
export const SUBFRAMES = 4;

// --- Main page: cursor ---------------------------------------------------------

/**
 * Cursor keys in site viewport pixels. `to` is a row index (resolved to the
 * row's name at capture time), 'toggle', or explicit {x, y}. Moves ease with
 * the site curve from the previous key. `show` / `hide` fade the drawn ring.
 */
export const CURSOR = [
  { t: 10.0, at: { x: 1500, y: 1000 }, show: true },
  { t: 10.8, from: 10.0, to: 0 }, // This Site
  { t: 13.3, from: 12.6, to: 2 }, // SCI Copilot
  { t: 15.7, from: 15.0, to: 4 }, // Housing and Fertility
  { t: 17.6, from: 17.0, to: { x: 1500, y: 1060 } },
  { t: 17.9, hide: true },
  { t: 31.2, at: { x: 1500, y: 420 }, show: true },
  { t: 31.9, from: 31.2, to: 'toggle' },
  { t: 32.0, click: true },
  { t: 33.0, from: 32.4, to: { x: 1480, y: 300 } },
  { t: 33.2, hide: true },
];
export const CURSOR_FADE = 0.3;
export const PRESS = 0.15;
export const THEME_SWITCH = 32.0;
export const THEME_DURATION = 0.5;

// --- Case study page -----------------------------------------------------------

export const CASE = {
  url: 'work/sci-copilot/',
  load: 40.9, // the page's own heading reveal starts here
  scroll: { t0: 42.2, t1: 44.4, to: 600 },
  start: 40.5, // first composited frame
  end: 45.2, // last composited frame
};

/** Main-page capture runs until the case page has fully slid in. */
export const MAIN_END = 41.4;

// --- Compositor ------------------------------------------------------------------

/** Frame scale keys: 1 is full-bleed, 0.8 is the framed site window. */
export const FRAMED = 0.8;
export const SCALE_KEYS = [
  { t0: 2.8, t1: 4.0, to: FRAMED },
  { t0: 18.5, t1: 19.7, to: 1 },
  { t0: 21.5, t1: 22.7, to: FRAMED },
];

export function frameScale(t) {
  let s = 1;
  for (const k of SCALE_KEYS) {
    if (t < k.t0) break;
    s = lerp(s, k.to, ease(span(t, k.t0, k.t1)));
  }
  return s;
}

export const SLIDE = { t0: 40.5, t1: 41.4 }; // Contact out, case study in
export const DRIFT = { t0: 36.5, t1: 40.5, to: 1.02 }; // slow push on Contact
export const OUTRO = { t0: 44.6, t1: 45.2 }; // case frame dissolves

export const CAPTIONS = [
  { in: 4.2, out: 6.7, text: 'One Three.js object, five forms.' },
  { in: 7.15, out: 9.3, text: 'Scroll drives the morph.' },
  { in: 9.75, out: 11.8, text: 'Six projects, six hoops.' },
  { in: 12.25, out: 18.0, text: 'Hover a project and its hoop lights.' },
  { in: 22.8, out: 24.5, text: 'Experience, braided.' },
  { in: 24.95, out: 26.6, text: 'Product Management Intern, GovTech.' },
  { in: 29.3, out: 31.4, text: 'Stack, as seven wireframe spheres.' },
  { in: 31.85, out: 34.0, text: 'One toggle inverts everything.' },
  { in: 36.8, out: 40.2, text: 'Everything converges to one axis.' },
  { in: 41.4, out: 44.4, text: 'Every project has its own write-up.' },
];

export const INDEX = [
  { in: 4.2, out: 9.3, text: '01 / 05' },
  { in: 9.75, out: 18.0, text: '02 / 05' },
  { in: 22.8, out: 26.6, text: '03 / 05' },
  { in: 29.3, out: 34.0, text: '04 / 05' },
  { in: 36.8, out: 40.2, text: '05 / 05' },
];

export const REVEAL = 1.05; // clip reveal, from the site's [data-reveal]
export const EXIT = 0.5;
export const STAGGER = 0.08;

export const END = {
  title: { in: 45.4, text: 'Alexius Lee' },
  links: { in: 45.9, items: ['alexius-lee.vercel.app', 'github.com/axlxius'] },
};

/** Optional voiceover, timed against the cut. */
export const VOICEOVER = [
  { t: 1.5, line: "I'm Alexius, a business and financial technology student, interning at GovTech." },
  { t: 7.0, line: 'My site is one 3D object that reshapes as you scroll.' },
  { t: 10.5, line: 'Each project owns a hoop. Hover a project, and its hoop lights.' },
  { t: 21.5, line: 'Experience becomes a braid, and my skills, seven spheres.' },
  { t: 36.5, line: 'Everything converges to one point: get in touch.' },
  { t: 46.0, line: 'alexius-lee dot vercel dot app.' },
];

/** Stills checked before the full render, one per shot. */
export const QA = [1.2, 3.4, 5.5, 7.4, 11.5, 13.8, 19.6, 24.0, 32.2, 38.5, 40.95, 43.5, 48.0];
