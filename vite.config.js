import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Every HTML page must be listed here to be built. Project write-ups live at
// work/<slug>/index.html and are served at /work/<slug>/.
const pages = ['sci-copilot', 'portfolio-dashboard', 'housing-and-fertility', 'growcerysg'];

export default defineConfig({
  // Relative base so the build also works from a subpath, e.g. GitHub Pages.
  base: './',
  server: {
    port: 5173,
    open: true,
  },
  build: {
    target: 'es2020',
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
