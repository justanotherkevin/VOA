// Boots a dedicated Electron instance (rather than the shared worker-scoped
// `electronApp` fixture — see fixtures-dev.ts) because this test needs to
// observe the actual app-launch model preload (main.ts's
// `transcriberService.preloadCurrentModel()` fire-and-forget call), which has
// already run and resolved by the time any test using the shared fixture
// gets control. Uses its own store file so it doesn't race the shared app
// instance, which stays alive for the rest of the suite.
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { e2eConfig } from '@e2e/config';
import { DEFAULT_SHORTCUTS } from '@/main/store';
import {
  getVisibleWindows,
  launchElectronApp,
} from '@e2e/utils/common.helpers';

const STORE_NAME = 'audio-to-text-test-startup-toast';

function storeFilePath(): string {
  return path.join(e2eConfig.appStorePath, `${STORE_NAME}.json`);
}

function initializeTestStore(): void {
  if (!fs.existsSync(e2eConfig.appStorePath)) {
    fs.mkdirSync(e2eConfig.appStorePath, { recursive: true });
  }
  fs.writeFileSync(
    storeFilePath(),
    JSON.stringify(
      {
        meetings: [],
        meetingsMigrated: true,
        shortcuts: DEFAULT_SHORTCUTS,
        // Matches the model the shared fixture seeds elsewhere in the suite,
        // so it's already warm in the local Whisper/transformers.js cache
        // and this test isn't paying for a real model download.
        modelPreferences: {
          selectedModel: 'Xenova/whisper-tiny',
          multilingual: false,
          quantized: false,
          language: 'english',
          asrType: 'whisper',
        },
      },
      null,
      2,
    ),
  );
}

function cleanupTestStore(): void {
  const file = storeFilePath();
  if (fs.existsSync(file)) {
    fs.rmSync(file, { force: true });
  }
}

test.describe('App startup — model load toast', () => {
  test('the "Loading model" toast shown on launch disappears once the model finishes loading', async () => {
    test.setTimeout(20_000);
    initializeTestStore();

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
      cleanupTestStore();
    }
  });
});
