import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.e2e configuration before running tests
dotenv.config({ path: path.join(__dirname, '.env.e2e') });

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  retries: 0,
  workers: 1,
  use: {
    trace: 'on-first-retry',
  },
  env: {
    NODE_ENV: 'production',
  },
});
