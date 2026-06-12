import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.e2e configuration before running tests
dotenv.config({ path: path.join(__dirname, '.env.e2e') });

// Must be set imperatively — defineConfig's top-level `env` is not a valid
// Playwright property and does not affect process.env in the test runner.
// fixtures.ts reads process.env.NODE_ENV to choose prod vs dev fixtures.
process.env.NODE_ENV = 'production';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  retries: 0,
  workers: 1,
  use: {
    trace: 'on-first-retry',
  },
});
