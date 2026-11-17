/**
 * Renders public/og-image.png (1200x630): the hero cloud with the name set
 * over it, taken from the running site so it always matches.
 *
 *   npx vite preview --port 4173 &     (in the repo root, after npm run build)
 *   node og.mjs                        (in video/)
 */
import { chromium } from 'playwright';

const URL_ = process.argv[2] ?? 'http://localhost:4173/?tier=high&p=0';
const OUT = new URL('../public/og-image.png', import.meta.url).pathname;

const browser = await chromium.launch({
  // Set CHROME_PATH to use a Chromium other than the one Playwright installed.
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1,
  colorScheme: 'dark',
  reducedMotion: 'reduce', // a still frame: no intro, no drift
});
await page.goto(URL_, { waitUntil: 'load' });
await page.addStyleTag({
  content: `
    .hud, .scrubber, .playhead, .grain, .shade, .cursor, .title-top, .title-cue { display: none !important; }
    .title-stage { min-height: 630px; padding-bottom: 64px; }
    .title-line { font-size: 26px; max-width: 30ch; color: rgb(255 255 255 / 0.72); }
  `,
});
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(4000);
await page.screenshot({ path: OUT, type: 'png' });
await browser.close();
console.log('wrote', OUT);
