import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';

import { BOOT_SCRIPT, FONT_PRELOAD, renderBody, renderMeta } from './src/markup/page.ts';

// Every HTML page must be listed here to be built. Project write-ups live at
// work/<slug>/index.html and are served at /work/<slug>/.
const pages = ['sci-copilot', 'portfolio-dashboard', 'housing-and-fertility', 'growcerysg'];

/**
 * Fills the placeholders in the HTML entry points:
 *
 *   <!--@meta-->  title, description, Open Graph, JSON-LD   (home page)
 *   <!--@boot-->  pre-paint theme/motion script + font preload (every page)
 *   <!--@body-->  the page itself, rendered from src/data/content.ts (home page)
 *
 * The content file is a dependency of this config, so editing it restarts the
 * dev server and the page comes back with the new copy.
 */
function prerender(): Plugin {
  return {
    name: 'portfolio-prerender',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return html
          .replace('<!--@meta-->', renderMeta())
          .replace('<!--@boot-->', FONT_PRELOAD + BOOT_SCRIPT)
          .replace('<!--@body-->', renderBody());
      },
    },
  };
}

export default defineConfig({
  // Relative base so the build also works from a subpath, e.g. GitHub Pages.
  base: './',
  plugins: [prerender()],
  server: {
    port: 5173,
    open: true,
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        ...Object.fromEntries(
          pages.map((slug) => [slug, resolve(__dirname, `work/${slug}/index.html`)])
        ),
      },
    },
  },
});
