import gsap from 'gsap';

import { el } from '../core/env.ts';
import { motion } from '../core/motion.ts';

const TILE = 128;
const FPS = 12;

/**
 * Film grain: one small noise tile, generated once, repeated over the page
 * and nudged to a new offset a dozen times a second. With reduced motion it
 * stays put, as a paper texture.
 */
export function createGrain() {
  const canvas = el('canvas');
  canvas.width = TILE;
  canvas.height = TILE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const image = ctx.createImageData(TILE, TILE);
  for (let i = 0; i < image.data.length; i += 4) {
    const v = Math.random() < 0.5 ? 0 : 255;
    image.data[i] = image.data[i + 1] = image.data[i + 2] = v;
    image.data[i + 3] = Math.random() * 255;
  }
  ctx.putImageData(image, 0, 0);

  const grain = el('div', 'grain', { 'aria-hidden': 'true' });
  grain.style.backgroundImage = `url(${canvas.toDataURL('image/png')})`;
  document.body.append(grain);

  let last = 0;
  gsap.ticker.add((time) => {
    if (motion.reduced || document.hidden || time - last < 1 / FPS) return;
    last = time;
    const x = Math.round((Math.random() - 0.5) * 2 * 64);
    const y = Math.round((Math.random() - 0.5) * 2 * 64);
    grain.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  });
}
