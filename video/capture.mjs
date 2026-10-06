/**
 * Stage 1: capture the live site frame by frame.
 *
 * The site runs on one requestAnimationFrame loop plus a handful of CSS
 * transitions. Both are put on a virtual clock that only advances when this
 * script says so: rAF and performance.now are replaced before any site code
 * runs, and every CSS animation is paused and seeked to the virtual time. The
 * result is identical frames on every run, however slow the machine is.
 *
 *   node capture.mjs [--url http://localhost:4173/] [--out out] [--qa]
 *
 * --qa steps through the whole timeline (state is history dependent) but only
 * screenshots the frames the QA stills need.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

import {
  CASE, CURSOR, CURSOR_FADE, FPS, H, MAIN_END, PRESS, QA, STOPS, SUBFRAMES, BLUR_SPEED, W,
  clamp01, ease, lenis, lerp, scrollAt, span,
} from './timeline.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const BASE = opt('--url', 'http://localhost:4173/');
const OUT = opt('--out', new URL('./out', import.meta.url).pathname);
const QA_ONLY = args.includes('--qa');

const qaFrames = new Set(QA.map((t) => Math.round(t * FPS)));
const wanted = (f) => !QA_ONLY || qaFrames.has(f);

const started = Date.now();
const log = (...a) => console.log(`[${((Date.now() - started) / 1000).toFixed(0)}s]`, ...a);
const pad = (n) => String(n).padStart(5, '0');

// Runs in the page before any site script.
function virtualClock() {
  const nativeRAF = window.requestAnimationFrame.bind(window);
  let now = 0;
  let queue = [];
  const starts = new WeakMap();

  performance.now = () => now;
  window.requestAnimationFrame = (cb) => {
    queue.push(cb);
    return queue.length;
  };
  window.cancelAnimationFrame = () => {};

  function sync() {
    for (const a of document.getAnimations()) {
      if (!starts.has(a)) {
        starts.set(a, now);
        a.pause();
      }
      a.currentTime = now - starts.get(a);
    }
  }

  // Advance virtual time, run one rAF tick, then let the browser render twice
  // so IntersectionObserver callbacks land and any transitions they start are
  // caught at this instant.
  window.__step = async (ms) => {
    now += ms;
    const cbs = queue;
    queue = [];
    cbs.forEach((cb) => cb(now));
    sync();
    await new Promise((r) => nativeRAF(() => nativeRAF(r)));
    sync();
  };
}

/** Cursor state at time t, in site viewport pixels. */
function cursorAt(t, targets) {
  let pos = { x: 0, y: 0 };
  let opacity = 0;
  let press = 0;
  const resolve = (to) =>
    typeof to === 'number' ? targets.rows[to] : to === 'toggle' ? targets.toggle : to;

  for (const k of CURSOR) {
    if (k.show && t >= k.t) {
      pos = { ...k.at };
      opacity = clamp01((t - k.t) / CURSOR_FADE);
    }
    if (k.hide && t >= k.t) opacity = 1 - clamp01((t - k.t) / CURSOR_FADE);
    if (k.to !== undefined && t >= k.from) {
      const target = resolve(k.to);
      const e = ease(span(t, k.from, k.t));
      pos = { x: lerp(pos.x, target.x, e), y: lerp(pos.y, target.y, e) };
    }
    if (k.click) press = Math.max(press, 1 - Math.min(1, Math.abs(t - k.t) / PRESS));
  }
  return { x: pos.x, y: pos.y, opacity, press };
}

/** Times to capture for frame f, given a scroll function (px at t). */
function instants(f, scroll) {
  const t = f / FPS;
  const speed = Math.abs(scroll(t + 1 / FPS) - scroll(t));
  if (speed <= BLUR_SPEED) return [t];
  // 180-degree shutter: sub-frames span the first half of the frame interval.
  return Array.from({ length: SUBFRAMES }, (_, k) => t + (k * 0.5) / FPS / SUBFRAMES);
}

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const context = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
  colorScheme: 'dark',
  reducedMotion: 'no-preference',
});
await context.addInitScript(virtualClock);

async function open(url) {
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Animation.enable');
  await cdp.send('Animation.setPlaybackRate', { playbackRate: 0 });
  await page.goto(url, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  return page;
}

async function shoot(page, file) {
  await page.screenshot({ path: file, type: 'png' });
}

const manifest = { fps: FPS, qa: QA_ONLY, main: {}, case: {}, cursor: {} };

// --- Main page ---------------------------------------------------------------
{
  await mkdir(join(OUT, 'main'), { recursive: true });
  const page = await open(BASE);

  const measured = await page.evaluate((stops) => {
    const vh = window.innerHeight;
    const max = document.documentElement.scrollHeight - vh;
    const out = {};
    for (const [name, s] of Object.entries(stops)) {
      const el = document.getElementById(s.section);
      const r = el.getBoundingClientRect();
      const centre = r.top + window.scrollY + r.height / 2 - vh / 2;
      out[name] = Math.round(Math.min(max, Math.max(0, centre + s.offset)));
    }
    return out;
  }, STOPS);

  const targets = await page.evaluate((workY) => {
    const rows = [...document.querySelectorAll('[data-strand]')].map((row) => {
      const name = row.querySelector('.work-name').getBoundingClientRect();
      const r = row.getBoundingClientRect();
      return {
        x: name.left + Math.min(name.width / 2, 120),
        y: r.top + window.scrollY - workY + r.height / 2,
      };
    });
    const b = document.querySelector('[data-theme-toggle]').getBoundingClientRect();
    return { rows, toggle: { x: b.left + b.width / 2, y: b.top + b.height / 2 } };
  }, measured.work);

  manifest.stops = measured;
  log('stops', JSON.stringify(measured));

  const scroll = (t) => scrollAt(t, measured);
  const last = Math.round(MAIN_END * FPS);
  const clickAt = CURSOR.find((k) => k.click)?.t;
  let clock = -1 / FPS; // first step advances to t = 0
  let mouseShown = false;
  let lastMouse = null;
  let clicked = false;

  for (let f = 0; f <= last; f++) {
    const times = instants(f, scroll);
    const files = [];

    for (let k = 0; k < times.length; k++) {
      const t = times[k];
      await page.evaluate((y) => window.scrollTo(0, y), Math.round(scroll(t)));

      const c = cursorAt(t, { rows: targets.rows, toggle: targets.toggle });
      const live = c.opacity > 0;
      if (live) {
        const key = `${c.x.toFixed(1)},${c.y.toFixed(1)}`;
        if (key !== lastMouse) await page.mouse.move(c.x, c.y);
        lastMouse = key;
        mouseShown = true;
      } else if (mouseShown) {
        // Park the pointer off every row, then tell the scene it has left.
        await page.mouse.move(W - 1, H - 1);
        await page.evaluate(() => document.dispatchEvent(new PointerEvent('pointerleave')));
        mouseShown = false;
        lastMouse = null;
      }
      if (!clicked && clickAt !== undefined && t >= clickAt) {
        await page.mouse.down();
        await page.mouse.up();
        clicked = true;
      }

      await page.evaluate((ms) => window.__step(ms), (t - clock) * 1000);
      clock = t;

      if (wanted(f)) {
        const file = k === 0 ? `${pad(f)}.png` : `${pad(f)}_${k}.png`;
        await shoot(page, join(OUT, 'main', file));
        files.push(file);
      }
    }

    if (files.length) manifest.main[f] = files;
    manifest.cursor[f] = cursorAt(f / FPS, targets);
    if (f % 30 === 0) log(`main ${f}/${last}`);
  }
  await page.close();
}

// --- Case study ----------------------------------------------------------------
{
  await mkdir(join(OUT, 'case'), { recursive: true });
  // Same context, so the light theme chosen on the main page carries over.
  const page = await open(new URL(CASE.url, BASE).href);
  const { t0, t1, to } = CASE.scroll;
  const scroll = (t) => lerp(0, to, lenis(span(t, t0, t1)));
  const first = Math.round(CASE.start * FPS);
  const last = Math.round(CASE.end * FPS);
  let clock = CASE.load;

  for (let f = first; f <= last; f++) {
    const times = instants(f, scroll);
    const files = [];
    for (let k = 0; k < times.length; k++) {
      // Before the page's own load moment the clock holds still.
      const t = Math.max(times[k], CASE.load);
      await page.evaluate((y) => window.scrollTo(0, y), Math.round(scroll(t)));
      await page.evaluate((ms) => window.__step(ms), (t - clock) * 1000);
      clock = t;
      if (wanted(f)) {
        const file = k === 0 ? `${pad(f)}.png` : `${pad(f)}_${k}.png`;
        await shoot(page, join(OUT, 'case', file));
        files.push(file);
      }
    }
    if (files.length) manifest.case[f] = files;
  }
  log(`case ${first}-${last}`);
  await page.close();
}

await writeFile(join(OUT, QA_ONLY ? 'manifest-qa.json' : 'manifest.json'), JSON.stringify(manifest));
await browser.close();
log('done');
