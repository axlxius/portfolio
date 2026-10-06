/**
 * Stage 2: composite and encode.
 *
 * Opens compositor.html, calls render(t) for every frame and pipes the
 * screenshots straight into ffmpeg. Run capture.mjs first.
 *
 *   node render.mjs          # full film, web cut and poster in out/
 *   node render.mjs --qa     # QA stills and a contact sheet in out/qa/
 */
import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

import { FPS, FRAMES, H, QA, W } from './timeline.mjs';

const ROOT = new URL('.', import.meta.url).pathname;
const OUT = join(ROOT, 'out');
const QA_ONLY = process.argv.includes('--qa');

const started = Date.now();
const log = (...a) => console.log(`[${((Date.now() - started) / 1000).toFixed(0)}s]`, ...a);

// A small static server, so the compositor can import timeline.mjs as a module.
const TYPES = { '.html': 'text/html', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  const path = normalize(join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!path.startsWith(ROOT)) return res.writeHead(403).end();
  try {
    await stat(path);
    res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' });
    createReadStream(path).pipe(res);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

function run(cmd, args, input) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: [input ? 'pipe' : 'ignore', 'inherit', 'inherit'] });
    p.on('error', reject);
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
    if (input) input(p.stdin);
  });
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('compositor:', e.message));
const manifest = QA_ONLY ? 'out/manifest-qa.json' : 'out/manifest.json';
await page.goto(`${origin}/compositor.html?manifest=${manifest}`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });

async function frameAt(t) {
  await page.evaluate((t) => window.render(t), t);
  return page.screenshot({ type: 'png' });
}

if (QA_ONLY) {
  const dir = join(OUT, 'qa');
  await mkdir(dir, { recursive: true });
  const files = [];
  for (const t of QA) {
    const file = join(dir, `qa-${t.toFixed(2).padStart(5, '0')}.png`);
    await page.evaluate((t) => window.render(t), Math.round(t * FPS) / FPS);
    await page.screenshot({ path: file, type: 'png' });
    files.push(file);
    log('qa', t);
  }
  // Contact sheet, four across.
  const inputs = files.flatMap((f) => ['-i', f]);
  const cells = files.map((_, i) => `[${i}]scale=480:-1[c${i}]`).join(';');
  const layout = files.map((_, i) => `${(i % 4) * 480}_${Math.floor(i / 4) * 270}`).join('|');
  const pads = files.map((_, i) => `[c${i}]`).join('');
  await run('ffmpeg', ['-loglevel', 'error', '-y', ...inputs, '-filter_complex',
    `${cells};${pads}xstack=inputs=${files.length}:layout=${layout}:fill=gray`, join(dir, 'contact-sheet.jpg')]);
  log('contact sheet', join(dir, 'contact-sheet.jpg'));
} else {
  const master = join(OUT, 'showcase-1080p.mp4');
  await run('ffmpeg', [
    '-loglevel', 'error', '-y',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-movflags', '+faststart', master,
  ], async (stdin) => {
    for (let f = 0; f < FRAMES; f++) {
      const png = await frameAt(f / FPS);
      if (!stdin.write(png)) await new Promise((r) => stdin.once('drain', r));
      if (f % 30 === 0) log(`frame ${f}/${FRAMES}`);
    }
    stdin.end();
  });
  log('master', master);

  // Web cut: 720p, two-pass to land under 8 MB for embedding on the site.
  const web = join(OUT, 'showcase-720p.mp4');
  const common = ['-y', '-loglevel', 'error', '-i', master, '-vf', 'scale=1280:720:flags=lanczos',
    '-c:v', 'libx264', '-preset', 'slow', '-b:v', '1150k', '-pix_fmt', 'yuv420p',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709'];
  const passlog = join(OUT, 'x264pass');
  await run('ffmpeg', [...common, '-pass', '1', '-passlogfile', passlog, '-an', '-f', 'mp4', '/dev/null']);
  await run('ffmpeg', [...common, '-pass', '2', '-passlogfile', passlog, '-an', '-movflags', '+faststart', web]);
  log('web', web);

  // Poster: the held end card.
  await page.evaluate((t) => window.render(t), (FRAMES - 1) / FPS);
  await page.screenshot({ path: join(OUT, 'poster.png'), type: 'png' });
  log('poster');
}

await browser.close();
server.close();
