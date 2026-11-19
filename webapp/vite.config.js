import { defineConfig } from 'vite';

// Builds into ../docs, which GitHub Pages serves from the default branch.
export default defineConfig({
  base: './',
  build: { outDir: '../docs', emptyOutDir: true },
});
