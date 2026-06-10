import path from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tsconfigPathsPlugin from 'vite-tsconfig-paths';

// Properly instantiate tsconfig paths plugin
const tsconfigPaths = tsconfigPathsPlugin({
  projects: [path.resolve('tsconfig.json')],
});

export default defineConfig({
  main: {
    entry: 'src/main/main.ts',
    plugins: [tsconfigPaths, externalizeDepsPlugin()],
    build: {
      outDir: 'dist/main',
      sourcemap: 'hidden',
    },
  },
  preload: {
    entry: 'src/main/preload.ts',
    plugins: [tsconfigPaths, externalizeDepsPlugin()],
    build: {
      outDir: 'dist/preload',
      lib: {
        entry: 'src/main/preload.ts',
        formats: ['cjs'],
      },
      sourcemap: 'hidden',
    },
  },
  renderer: {
    entry: 'src/renderer/index.html',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    plugins: [tsconfigPaths, react()],
    publicDir: 'public',
    server: {
      fs: {
        allow: ['.', 'public'],
      },
    },
    build: {
      outDir: 'dist/renderer',
      sourcemap: 'hidden',
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'src/renderer/index.html'),
          notification: path.resolve(__dirname, 'src/renderer/notification.html'),
        },
      },
    },
  },
});
