/**
 * Playwright Fixtures for E2E Tests (Development Mode)
 *
 * Validates against development build from Vite dev server.
 * Used during feature development for fast feedback.
 *
 * Usage:
 *   // This is used via playwright.config.ts
 *   // Tests don't import this directly
 */

import {
  test as base,
  expect,
  _electron as electron,
  Page,
} from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { e2eConfig } from './config';
import { getDefaultTestTranscripts } from './fixtures-data';
import { DEFAULT_SHORTCUTS } from '@/main/store';

type ElectronFixtures = {
  electronApp: any;
  page: Page;
};

async function getMainWindow(electronApp: any): Promise<Page> {
  // Wait for at least one window to exist before we start polling.
  await electronApp.firstWindow();

  // Poll for the index.html window using page.url() which is synchronous and does not
  // require the page's JS execution context to be ready (unlike page.evaluate()).
  // - Tests 2+: app already running, window found on first iteration.
  // - Test 1 (fresh launch): may take a few iterations while the second window finishes loading.
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    for (const win of electronApp.windows()) {
      try {
        const url = win.url();
        if (url.includes('index.html')) {
          return win;
        }
      } catch {
        // window in transient state — skip and retry
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error('Timeout waiting for main window');
}

/**
 * Initialize test store with default fixture data
 * Creates the store directory and populates it with known test data
 */
function initializeTestStore(): void {
  const appStorePath = e2eConfig.appStorePath;

  try {
    // Create store directory if it doesn't exist
    if (!fs.existsSync(appStorePath)) {
      fs.mkdirSync(appStorePath, { recursive: true });
    }

    // Create the transcript-history.json file with default test data
    const storeName = process.env.VITE_STORE_NAME || 'audio-to-text-test';
    const storeFilePath = path.join(appStorePath, `${storeName}.json`);

    const storeData = {
      transcriptHistory: getDefaultTestTranscripts(),
      shortcuts: DEFAULT_SHORTCUTS,
      modelPreferences: {
        selectedModel: 'Xenova/whisper-tiny',
        multilingual: false,
        quantized: false,
        language: 'english',
        asrType: 'whisper',
      },
    };

    fs.writeFileSync(storeFilePath, JSON.stringify(storeData, null, 2));
    console.log('[fixtures-dev] Test store initialized at:', storeFilePath);
  } catch (e) {
    console.error('[fixtures-dev] Error initializing test store:', e);
  }
}

/**
 * Cleanup test store by removing the entire store directory
 * Ensures a clean state for the next test run
 */
function cleanupElectronStore(): void {
  const appStorePath = e2eConfig.appStorePath;

  if (fs.existsSync(appStorePath)) {
    try {
      // Remove entire directory recursively
      fs.rmSync(appStorePath, { recursive: true, force: true });
      console.log('[fixtures-dev] Test store cleaned up:', appStorePath);
    } catch (e) {
      console.error('[fixtures-dev] Error cleaning up electron-store:', e);
    }
  }
}

export const test = base.extend<ElectronFixtures>({
  electronApp: [
    async ({}, use) => {
      const app = await electron.launch({
        args: [path.join(__dirname, '../../dist/main/main.js')],
        env: {
          ...process.env,
          NODE_ENV: 'development',
          E2E_TEST: 'true',
        },
      });

      await use(app);
      await app.close();
    },
    { scope: 'worker' },
  ] as any,

  page: async ({ electronApp }, use) => {
    try {
      // Initialize test store with fixture data before each test
      initializeTestStore();
      const mainWindow = await getMainWindow(electronApp);

      if (mainWindow.isClosed?.()) {
        throw new Error('Main window closed immediately after getting it');
      }

      await mainWindow.waitForLoadState('domcontentloaded', { timeout: 10000 });

      await use(mainWindow);

      // Cleanup test store after each test completes
      cleanupElectronStore();
    } catch (error) {
      console.error('[fixtures-dev] Error in page fixture:', error);
      throw error;
    }
  },
});

export { expect };
