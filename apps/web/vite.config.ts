// vite.config.ts - Vite build configuration for the web app.
// Points workspace package aliases directly at TypeScript sources for fast HMR in dev mode.
// Splits heavy vendor chunks (Chakra, Konva, PDF, i18n) to improve initial load performance.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@keymap-highlight/cheatsheet-export': path.resolve(__dirname, '../../packages/cheatsheet-export/src/index.ts'),
      '@keymap-highlight/file-parsers': path.resolve(__dirname, '../../packages/file-parsers/src/index.ts'),
      '@keymap-highlight/layout-pipeline': path.resolve(__dirname, '../../packages/layout-pipeline/src/index.ts'),
      '@keymap-highlight/web': path.resolve(__dirname, './src'),
    },
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/zustand/')) return 'vendor-react';
          if (id.includes('node_modules/@chakra-ui/') || id.includes('node_modules/@emotion/')) return 'vendor-chakra';
          if (id.includes('node_modules/konva/') || id.includes('node_modules/react-konva/')) return 'vendor-konva';
          if (id.includes('node_modules/@react-pdf/')) return 'vendor-pdf';
          if (id.includes('node_modules/i18next/') || id.includes('node_modules/react-i18next/') || id.includes('node_modules/i18next-browser-languagedetector/')) return 'vendor-i18n';
        },
      },
    },
  },
});
