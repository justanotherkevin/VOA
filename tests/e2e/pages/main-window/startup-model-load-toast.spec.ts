// Boots a dedicated Electron instance (rather than the shared worker-scoped
// `electronApp` fixture — see fixtures-dev.ts) because this test needs to
// observe the actual app-launch model preload (main.ts's
// `transcriberService.preloadCurrentModel()` fire-and-forget call), which has
// already run and resolved by the time any test using the shared fixture
// gets control. Uses its own store file so it doesn't race the shared app
// instance, which stays alive for the rest of the suite.
import { test, expect } from '@playwright/test';
import {
  getVisibleWindows,
  launchElectronApp,
  writeE2eTestStore,
  removeStoreFile,
} from '@e2e/utils/common.helpers';

const STORE_NAME = 'audio-to-text-test-startup-toast';

test.describe('App startup — model load toast', () => {
  test('the "Loading model" toast shown on launch disappears once the model finishes loading', async () => {
    test.setTimeout(20_000);
    writeE2eTestStore(STORE_NAME);

    const electronApp = await launchElectronApp({
      NODE_ENV: 'development',
      E2E_STORE_NAME: STORE_NAME,
    });

    try {
      const { main } = await getVisibleWindows(electronApp);
      await main.waitForLoadState('domcontentloaded');

      // main.ts's preloadCurrentModel() broadcasts transcriber:progress from
      // the moment the window exists, which useTranscriber.ts renders as a
      // "Loading model… N%" toast (src/renderer/hooks/useTranscriber.ts).
      const loadingToast = main.getByText(/Loading model/).first();
      await expect(loadingToast).toBeVisible({ timeout: 20_000 });

      // Regression coverage for the bug where a successful preload never
      // sent transcriber:ready, so this toast stayed on screen forever.
      await expect(loadingToast).toBeHidden({ timeout: 20_000 });
    } finally {
      await electronApp.close();
      removeStoreFile(STORE_NAME);
    }
  });
});
