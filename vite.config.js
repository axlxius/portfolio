import { defineConfig } from 'vite';

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
  },
});
