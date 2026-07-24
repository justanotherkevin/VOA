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

import { test as base, expect, Page } from '@playwright/test';
import fs from 'fs';
import { e2eConfig } from '@e2e/config';
import {
  launchElectronApp,
  getStoreFilePath,
  writeE2eTestStore,
} from '@e2e/utils/common.helpers';

type ElectronFixtures = {
  electronApp: any;
  page: Page;
  cleanState: void;
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
  try {
    const storeName = process.env.VITE_STORE_NAME || 'audio-to-text-test';
    writeE2eTestStore(storeName);
    console.log(
      '[fixtures-dev] Test store initialized at:',
      getStoreFilePath(storeName),
    );
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
      // Write a clean store before the app launches so it reads no stale data on startup.
      // This is the only reliable initialization point — the app reads the file on boot,
      // and the worker-scoped app is shared across all tests in this worker.
      initializeTestStore();
      const app = await launchElectronApp({
        NODE_ENV: 'development',
        E2E_STORE_NAME: 'audio-to-text-test',
      });

      await use(app);
      try {
        await app.close();
      } catch (e) {
        console.error(
          '[fixtures-dev] app.close() failed (app may have crashed):',
          e,
        );
      }
      cleanupElectronStore();
    },
    { scope: 'worker' },
  ] as any,

  // auto:true — runs before and after every test without needing to be requested.
  // Clears meetings in the store AND notifies the renderer so useMeetings re-renders.
  cleanState: [
    async ({ electronApp }, use) => {
      // Wait for __e2eStore to be ready before clearing — it's set asynchronously
      // during app boot and cleanState can run before initializeStore() resolves.
      const waitForStore = async () => {
        const deadline = Date.now() + 10_000;
        while (Date.now() < deadline) {
          const ready = await electronApp.evaluate(
            () => !!(global as any).__e2eStore,
          );
          if (ready) return;
          await new Promise((r) => setTimeout(r, 100));
        }
        console.warn(
          '[fixtures-dev] __e2eStore not ready after 10s — clearing may be a no-op',
        );
      };

      const reset = async () => {
        await waitForStore();
        await electronApp.evaluate(({ BrowserWindow }: any) => {
          (global as any).__e2eStore?.set('meetings', []);
          BrowserWindow.getAllWindows().forEach((win: any) => {
            win.webContents.send('meetings:cleared');
          });
        });
      };
      await reset();
      await use();
      await reset();
    },
    { auto: true },
  ] as any,

  page: async ({ electronApp }, use) => {
    let mainWindow: Page | undefined;
    try {
      mainWindow = await getMainWindow(electronApp);

      if (mainWindow.isClosed?.()) {
        throw new Error('Main window closed immediately after getting it');
      }

      await mainWindow.waitForLoadState('domcontentloaded', { timeout: 10000 });

      await use(mainWindow);
    } catch (error) {
      console.error('[fixtures-dev] Error in page fixture:', error);
      throw error;
    }
  },
});

export { expect };
