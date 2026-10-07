// Build of the render bench (bench.html, src/bench.ts) as a self-contained static page with relative URLs,
// for publishing as an artifact: `bunx vite build -c vite.bench.config.ts`, then scripts/bench-pack.ts copies
// in the fonts and P(doom)'s timing data the engine fetches.
import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: './',
  publicDir: false,
  build: {
    target: 'esnext',
    outDir: 'dist-bench',
    emptyOutDir: true,
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: 'bench.html',
      output: { entryFileNames: 'assets/[name].js', chunkFileNames: 'assets/[name]-[hash].js' },
    },
  },
});
