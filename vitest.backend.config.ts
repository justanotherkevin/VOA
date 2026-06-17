import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
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
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Electron is not available in the Vitest Node environment.
      // Map it to a minimal stub so main-process modules can be imported in tests.
      electron: path.resolve(__dirname, './src/__mocks__/electron.ts'),
    },
  },
});
