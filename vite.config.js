import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  // Relative asset paths — required for Electron loadFile (file://)
  base: './',
  envDir: '.',
  envPrefix: 'VITE_',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    // Separate from electron-builder output (defaults to "dist" when unset)
    outDir: 'app',
    emptyOutDir: true,
  },
});
