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
    plugins: [tsconfigPaths, externalizeDepsPlugin()],
    build: {
      outDir: 'dist/main',
      sourcemap: 'hidden',
      rollupOptions: {
        // node-web-audio-api is in devDeps (test-only); externalizeDepsPlugin
        // only covers deps, so we must mark it external explicitly.
        external: ['node-web-audio-api'],
        input: {
          main: path.resolve(__dirname, 'src/main/main.ts'),
        },
      },
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
