/**
 * E2E tests for dictation workflow
 *
 * Tests the recording and transcription flow without visible UI:
 * 1. Recording starts/stops via hooks (useAudioRecorder + useRecordingFlow)
 * 2. Recording can be triggered via global shortcut
 * 3. Audio is recorded with microphone mock
 * 4. Audio is transcribed
 * 5. Transcript appears in history
 *
 * Note: The Recording UI component is intentionally not rendered.
 * Recording is controlled via hooks and responds to global shortcuts.
 * Tests run against the development build via Vite dev server (npm run test:e2e).
 *
 * User presses shortcut → Recording starts → Audio captured → Sent to main process
 * → AI transcription (Xenova Whisper) → Real-time updates → Final transcript stored
 */

import {
  startRecording,
  stopRecording,
} from './utils/dictation/recording-actions';
import { test, expect } from './fixtures';
import { Page } from '@playwright/test';
import { mountMockAudioChunks } from './utils/dictation/hardware-mocks';
import { getVisibleWindows } from './utils/common.helpers';

test.describe('Dictation Workflow', () => {
  let mainPage: Page;
  let notificationPage: Page;

  test.beforeEach(async ({ electronApp }) => {
    const { main, notification } = await getVisibleWindows(electronApp);
    mainPage = main;
    notificationPage = notification;
  });

  test('App launches has correct dictation process', async ({
    electronApp,
  }) => {
    test.setTimeout(20_000);

    // STEP 1: Confirm the app starts with no dictations (store is seeded clean by fixtures)
    await expect(
      mainPage.locator('text=No dictations yet'),
      'should start with empty dictations list',
    ).toBeVisible({ timeout: 5000 });
    // STEP 2: Start recording
    await startRecording(mainPage, electronApp);
    await expect(
      notificationPage.locator('text=recording'),
      'should show notification window with "Recording" message',
    ).toBeVisible();

    // Mock audio data
    await mountMockAudioChunks(mainPage, 'fairy-tails-story.mp3');

    // STEP 3: Stop recording → process audio to transcript
    await stopRecording(mainPage, electronApp);

    // STEP 4: Wait for the dictation to appear in the UI and verify transcript content
    await expect(
      mainPage.locator('text=No dictations yet'),
      'dictation should have appeared in the list',
    ).not.toBeVisible({ timeout: 15_000 });

    // Transcript lives under its own tab now — not visible on the default Overview tab.
    await mainPage.getByRole('tab', { name: 'Transcript' }).click();

    const transcript = mainPage.locator('.font-mono');
    await expect(transcript).toContainText('In the ancient land of Aldoria', {
      timeout: 15_000,
    });
  });
});
