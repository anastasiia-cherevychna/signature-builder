import { defineConfig } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Both builds produce one self-contained index.html (styles and code inlined), so the
// page works on any host AND when opened straight from a downloaded folder.
//   npm run build          → dist/          the live site, with photo hosting
//   npm run build:preview  → dist-preview/  a shareable preview, photo hosting switched off
export default defineConfig(({ mode }) => ({
  plugins: [viteSingleFile()],
  base: './',
  build: {
    outDir: mode === 'preview' ? 'dist-preview' : 'dist',
    assetsInlineLimit: 100_000_000,
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
}));
