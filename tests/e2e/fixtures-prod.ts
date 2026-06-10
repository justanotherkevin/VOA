/**
 * Playwright Fixtures for E2E Tests (Production Mode)
 *
 * Validates against production build artifacts (dist/).
 * Used in CI pipeline before shipping.
 *
 * Usage:
 *   // This is used via playwright.build.config.ts
 *   // Tests don't import this directly
 */

import { test as base, expect, _electron as electron, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { e2eConfig } from './config';

type ElectronFixtures = {
  electronApp: any;
  page: Page;
};

async function getMainWindow(electronApp: any): Promise<Page> {
  try {
    let mainWindow: Page | null = null;
    const firstWindow = await electronApp.firstWindow();
    const firstTitle = await firstWindow.title();

    if (firstTitle === 'Notification') {
      let mainWindowFound = false;

      try {
        const windows = await electronApp.windows();
        for (const window of windows) {
          try {
            const url = await window.evaluate(() => window.location.href);
            if (!url.includes('notification.html')) {
              mainWindow = window;
              mainWindowFound = true;
              break;
            }
          } catch {
            // Window might be closed, continue
          }
        }
      } catch {
        // Could not enumerate windows
      }

      if (!mainWindowFound) {
        mainWindow = await new Promise<Page>((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error('Timeout waiting for main window')),
            15000
          );

          electronApp.on('window', (window: Page) => {
            try {
              window
                .evaluate(() => window.location.href)
                .then((url) => {
                  if (!url.includes('notification.html')) {
                    clearTimeout(timeout);
                    resolve(window);
                  }
                })
                .catch(() => {
                  // Window might have closed, ignore
                });
            } catch {
              // Ignore listener errors
            }
          });
        });
      }
    } else {
      mainWindow = firstWindow;
    }

    if (!mainWindow) {
      throw new Error('Could not find main window');
    }

    return mainWindow;
  } catch (error) {
    console.error('[fixtures-prod] Error getting main window:', error);
    throw error;
  }
}

function cleanupElectronStore(): void {
  const appStorePath = e2eConfig.appStorePath;

  if (fs.existsSync(appStorePath)) {
    try {
      const files = fs.readdirSync(appStorePath);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(appStorePath, file);
          try {
            fs.unlinkSync(filePath);
          } catch (e) {
            // Ignore individual file deletion errors
          }
        }
      }
    } catch (e) {
      console.error('[fixtures-prod] Error cleaning electron-store:', e);
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
          NODE_ENV: 'production',
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
      cleanupElectronStore();
      const mainWindow = await getMainWindow(electronApp);

      if (mainWindow.isClosed?.()) {
        throw new Error('Main window closed immediately after getting it');
      }

      try {
        await mainWindow.waitForLoadState('networkidle', { timeout: 15000 });
      } catch (loadError) {
        console.warn('[fixtures-prod] Timeout waiting for page load:', loadError);
      }

      await use(mainWindow);
    } catch (error) {
      console.error('[fixtures-prod] Error in page fixture:', error);
      throw error;
    }
  },
});

export { expect };
