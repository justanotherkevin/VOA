import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    // Root-only option: Vitest ignores onConsoleLog inside a project.
    onConsoleLog(log) {
      // Suppress vitest's own advisory about arrow-function mock implementations
      if (log.includes('vi.fn() mock did not use')) return false;
    },
    projects: [
      {
        extends: true,
        plugins: [react()],
        test: {
          name: 'frontend',
          environment: 'jsdom',
          setupFiles: ['./src/setupTests.ts'],
          include: [
            'src/__tests__/**/*.{test,spec}.{ts,tsx}',
            'src/renderer/**/*.{test,spec}.{ts,tsx}',
          ],
        },
      },
      {
        extends: true,
        resolve: {
          alias: {
            // Electron is not available in the Vitest Node environment.
            // Map it to a minimal stub so main-process modules can be imported in tests.
            electron: path.resolve(__dirname, './src/__mocks__/electron.ts'),
          },
        },
        test: {
          name: 'backend',
          environment: 'node',
          setupFiles: ['./src/setupTests.ts'],
          include: ['src/main/**/*.{test,spec}.ts'],
          exclude: [
            '**/node_modules/**',
            '**/asr-accuracy.test.ts',
            '**/qwen-download.test.ts',
            '**/lmstudio-integration.test.ts',
          ],
        },
      },
      {
        extends: true,
        test: {
          name: 'asr',
          environment: 'node',
          include: ['src/main/__tests__/asr-accuracy.test.ts'],
          testTimeout: 1_800_000,
          hookTimeout: 1_800_000,
        },
      },
      {
        extends: true,
        test: {
          name: 'qwen',
          environment: 'node',
          include: ['src/main/__tests__/qwen-download.test.ts'],
          testTimeout: 600_000, // 10 min — first run downloads ~900 MB
          hookTimeout: 60_000,
        },
      },
      {
        extends: true,
        test: {
          name: 'lmstudio',
          environment: 'node',
          include: ['src/main/__tests__/lmstudio-integration.test.ts'],
          testTimeout: 120_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
