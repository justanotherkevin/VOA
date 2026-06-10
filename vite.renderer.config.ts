import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPathsPlugin from 'vite-tsconfig-paths';

const tsconfigPaths = tsconfigPathsPlugin({
  projects: [path.resolve(__dirname, 'tsconfig.json')],
});

/**
 * Renderer-only Vite config used by Playwright E2E tests.
 * Starts the Vite dev server without launching Electron,
 * so the test fixture can launch its own controlled Electron instance.
 */
export default defineConfig({
  root: path.resolve(__dirname, 'src/renderer'),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  plugins: [tsconfigPaths, react()],
  publicDir: path.resolve(__dirname, 'public'),
  server: {
    port: 5173,
    fs: {
      allow: [path.resolve(__dirname)],
    },
  },
  build: {
    outDir: path.resolve(__dirname, 'dist/renderer'),
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'src/renderer/index.html'),
        notification: path.resolve(__dirname, 'src/renderer/notification.html'),
      },
    },
  },
});
