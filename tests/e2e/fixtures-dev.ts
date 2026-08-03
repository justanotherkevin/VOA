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

// electronApp is deliberately scoped narrower than Playwright's built-in
// 'worker' scope: with workers:1 a worker-scoped app would be shared across
// every spec file in the run, letting state from one file's mocked audio/
// sessions bleed into the next (see the notification-visibility.spec.ts
// afterEach hang investigated when this was worker-scoped). Playwright has
// no native "per-file" scope, so this fixture is 'test'-scoped and manually
// caches by testInfo.file — relaunching only when the file changes, not on
// every individual test.
let cachedApp: any = null;
let cachedFile: string | null = null;

async function closeCachedApp(): Promise<void> {
  if (!cachedApp) return;
  const app = cachedApp;
  cachedApp = null;
  cachedFile = null;
  try {
    await app.close();
  } catch (e) {
    console.error(
      '[fixtures-dev] app.close() failed (app may have crashed):',
      e,
    );
  }
  cleanupElectronStore();
}

// Best-effort close of the last file's app: there's no "after all tests in
// this file, and this is the last file" fixture hook, so hang cleanup off
// the worker process naturally winding down instead.
process.once('beforeExit', () => {
  void closeCachedApp();
});

export const test = base.extend<ElectronFixtures>({
  electronApp: [
    async ({}, use, testInfo) => {
      if (cachedFile !== testInfo.file) {
        await closeCachedApp();
        // Write a clean store before the app launches so it reads no stale
        // data on startup — the app reads the file once, on boot.
        initializeTestStore();
        cachedApp = await launchElectronApp({
          NODE_ENV: 'development',
          E2E_STORE_NAME: 'audio-to-text-test',
        });
        cachedFile = testInfo.file;
      }
      await use(cachedApp);
    },
    // timeout: fixture setup (which now relaunches Electron on every file
    // change) runs before a test body's own test.setTimeout() call takes
    // effect, so it's still bound by playwright.config.ts's 10s default
    // unless overridden here — a slow relaunch under load was blowing past
    // that and crashing the worker.
    { scope: 'test', timeout: 30_000 },
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
          try {
            const ready = await electronApp.evaluate(
              () => !!(global as any).__e2eStore,
            );
            if (ready) return;
          } catch {
            // The app's execution context can be torn down mid-evaluate while
            // it is still booting after a relaunch — skip and retry.
          }
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
