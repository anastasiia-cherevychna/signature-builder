import { defineConfig } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` makes the normal site (dist/).
// `npm run build:preview` makes one self-contained HTML file (dist-preview/)
// for sharing a quick preview link, with photo hosting switched off.
export default defineConfig(({ mode }) => ({
  plugins: mode === 'preview' ? [viteSingleFile()] : [],
  build: {
    outDir: mode === 'preview' ? 'dist-preview' : 'dist',
    assetsInlineLimit: mode === 'preview' ? 100_000_000 : 4096,
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
}));
