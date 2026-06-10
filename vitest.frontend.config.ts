import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    include: [
      'src/__tests__/**/*.{test,spec}.{ts,tsx}',
      'src/renderer/**/*.{test,spec}.{ts,tsx}',
    ],
    onConsoleLog(log) {
      // Suppress vitest's own advisory about arrow-function mock implementations
      if (log.includes('vi.fn() mock did not use')) return false;
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
