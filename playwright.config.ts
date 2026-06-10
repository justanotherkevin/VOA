import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Load .env configuration first, then .env.e2e (to override)
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.e2e') });

const devServerPort = process.env.VITE_DEV_SERVER_PORT || '5173';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 10000,
  retries: 0,
  workers: 1,
  reporter: [['./tests/e2e/utils/custom-reporter.ts']],
  use: {
    trace: 'on-first-retry',
    env: {
      PLAYWRIGHT_TEST: 'true',
    },
  },
  webServer: {
    command: 'npm run dev:renderer',
    url: `http://localhost:${devServerPort}`,
    reuseExistingServer: true,
    timeout: 10000,
  },
});
