import { el } from '../core/env.ts';

/**
 * The two match cuts that join the scenes.
 *
 *  - The circle: the dot of the "i" in the name grows until it fills the
 *    screen, and the page is in negative for the work reel.
 *  - The band: a hairline thickens until it fills the screen, and the page
 *    returns to positive for the timeline.
 *
 * Both are scrubbed, so scrolling back plays them in reverse. Each wipe is a
 * plain element painted beneath the particles and the page, in the colour the
 * page is about to become; when it covers the screen the tokens flip under it
 * (data-invert) and it is hidden, so the swap itself is never seen.
 */
export interface Dot {
  x: number;
  y: number;
  size: number;
}

export function createWipes(onInk: (inverted: boolean) => void) {
  const root = document.documentElement;
  const circle = el('div', 'wipe wipe--circle', { 'aria-hidden': 'true' });
  const band = el('div', 'wipe wipe--band', { 'aria-hidden': 'true' });
  document.body.prepend(circle, band);

  let w = 0; // circle progress
  let u = 0; // band progress
  let dot: Dot | null = null;
  let lineY = 0;
  let inkInverted = false;

  function apply() {
    const inverted = w >= 1 && u < 1;
    root.toggleAttribute('data-invert', inverted);

    // The particles change ink halfway through each wipe, while the wipe
    // already covers most of what they are drawn over.
    const ink = w >= 0.5 && u < 0.5;
    if (ink !== inkInverted) {
      inkInverted = ink;
      onInk(ink);
    }

    if (!inverted && w > 0 && w < 1 && dot) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // Far enough to cover the corner furthest from the dot.
      const reach = Math.hypot(Math.max(dot.x, vw - dot.x), Math.max(dot.y, vh - dot.y)) * 2;
      const grow = w * w * (3 - 2 * w);
      const scale = 1 + grow * (reach / dot.size);
      circle.style.display = 'block';
      circle.style.width = circle.style.height = `${dot.size}px`;
      circle.style.left = `${dot.x - dot.size / 2}px`;
      circle.style.top = `${dot.y - dot.size / 2}px`;
      // Square like the dot it starts as, round by the time it is a circle.
      circle.style.borderRadius = `${Math.min(1, w * 6) * 50}%`;
      circle.style.transform = `scale(${scale.toFixed(3)})`;
    } else {
      circle.style.display = 'none';
    }

    const banding = w >= 1 && u > 0 && u < 1;
    root.toggleAttribute('data-wiping', banding || circle.style.display === 'block');

    if (banding) {
      const vh = window.innerHeight;
      const grow = u * u * (3 - 2 * u);
      band.style.display = 'block';
      band.style.transformOrigin = `50% ${lineY}px`;
      band.style.transform = `scaleY(${Math.max(1 / vh, grow).toFixed(4)})`;
    } else {
      band.style.display = 'none';
    }
  }

  return {
    setCircle(value: number, origin: Dot | null) {
      w = Math.min(1, Math.max(0, value));
      if (origin) dot = origin;
      apply();
    },
    setBand(value: number, y: number) {
      u = Math.min(1, Math.max(0, value));
      lineY = y;
      apply();
    },
    get inverted() {
      return root.hasAttribute('data-invert');
    },
    get inkInverted() {
      return inkInverted;
    },
    /** Back to positive, with nothing showing. */
    reset() {
      w = 0;
      u = 0;
      apply();
    },
  };
}

export type Wipes = ReturnType<typeof createWipes>;

/**
 * Where the dot of an "i" is drawn, in viewport pixels.
 *
 * Text has no API for a glyph's parts, so the dot is found by drawing the
 * letter twice on a canvas, once dotted and once dotless, and keeping the
 * pixels that differ. Its position on the page comes from the letter's box
 * and its baseline, read with a zero-height probe.
 */
export function measureDot(char: HTMLElement): Dot | null {
  const style = getComputedStyle(char);
  const size = parseFloat(style.fontSize);
  if (!size) return null;

  const canvas = document.createElement('canvas');
  const pad = Math.ceil(size * 0.4);
  canvas.width = Math.ceil(size * 1.2) + pad * 2;
  canvas.height = Math.ceil(size * 1.6) + pad * 2;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  const stretch = parseFloat(style.fontStretch);
  // Canvas takes the width axis as a keyword; pick the nearest.
  const keywords: Array<[number, CanvasFontStretch]> = [
    [50, 'ultra-condensed'], [62.5, 'extra-condensed'], [75, 'condensed'], [87.5, 'semi-condensed'],
    [100, 'normal'], [112.5, 'semi-expanded'], [125, 'expanded'],
  ];
  const nearest = keywords.reduce((a, b) => (Math.abs(b[0] - stretch) < Math.abs(a[0] - stretch) ? b : a));
  const baseline = canvas.height - pad - size * 0.3;

  const draw = (glyph: string) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `${style.fontWeight} ${size}px ${style.fontFamily}`;
    ctx.fontStretch = Number.isFinite(stretch) ? nearest[1] : 'normal';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#000';
    ctx.fillText(glyph, pad, baseline);
    return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  };

  const dotted = draw('i');
  const dotless = draw('ı');
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4 + 3;
      if (dotted[i] > 128 && dotless[i] < 64) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (!Number.isFinite(minX)) return null;

  // The letter's baseline on the page.
  const probe = document.createElement('span');
  probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
  char.append(probe);
  const pageBaseline = probe.getBoundingClientRect().top;
  probe.remove();
  const left = char.getBoundingClientRect().left;

  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  return {
    x: left + (minX - pad) + w / 2,
    y: pageBaseline - (baseline - minY) + h / 2,
    size: Math.max(w, h),
  };
}
