// tsup.config.ts - Build configuration for the cheatsheet-export package.
// Outputs a single ESM bundle with TypeScript declarations and source maps; no code splitting.
import { defineConfig } from 'tsup';

export default defineConfig((options) => ({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: !options.watch,
  splitting: false,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
}));
