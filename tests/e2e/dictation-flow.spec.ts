/**
 * E2E tests for dictation workflow
 *
 * Tests the recording flow and that the resulting transcript reaches the UI
 * — plumbing (renderer → IPC → store → UI), not Whisper's transcription
 * accuracy. That's covered separately by the real-model accuracy harness
 * (`npm run test:asr`, src/main/__tests__/asr-accuracy.test.ts); this spec
 * mocks the transcription result (mockTranscript, seed.helpers.ts) with text
 * captured from a real run of this same audio file, so it doesn't need the
 * Whisper model loaded at all:
 * 1. Recording starts/stops via hooks (useAudioRecorder + useRecordingFlow)
 * 2. Recording can be triggered via global shortcut
 * 3. Audio is recorded with microphone mock
 * 4. Mocked transcript is returned in place of real Whisper output
 * 5. Transcript appears in history
 *
 * Note: The Recording UI component is intentionally not rendered.
 * Recording is controlled via hooks and responds to global shortcuts.
 * Tests run against the development build via Vite dev server (npm run test:e2e).
 *
 * User presses shortcut → Recording starts → Audio captured → Sent to main process
 * → transcription (mocked) → Real-time updates → Final transcript stored
 */

import {
  startDictation,
  stopDictation,
} from './utils/dictation/recording-actions';
import { test, expect } from './fixtures';
import { Page } from '@playwright/test';
import { mountMockAudioChunks } from './utils/dictation/hardware-mocks';
import { getVisibleWindows } from './utils/common.helpers';
import { mockTranscript } from './utils/seed.helpers';

// Captured from a real Whisper run of fairy-tails-story.mp3 — kept verbatim
// (including its transcription quirks) rather than cleaned up, since this
// only needs to be realistic plumbing content, not accurate text.
const MOCK_TRANSCRIPT =
  'In the ancient land of Aldoria, where skies shimmered and forests ' +
  'whispered secrets to The Wind lived a dragon named Zephos. Not "the ' +
  'Bernatoll" downkind but he was gentle wise with eyes like old stars ' +
  'even in birds fell silent when He passed';

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
    // Dictations section is collapsed by default — expand it to see its empty-state line.
    await mainPage
      .getByTestId('meeting-list-section-toggle-dictations')
      .click();

    // STEP 1: Confirm the app starts with no dictations (store is seeded clean by fixtures)
    await expect(
      mainPage.locator('text=No dictations yet'),
      'should start with empty dictations list',
    ).toBeVisible({ timeout: 5000 });
    // STEP 2: Start dictation (the dictation shortcut, not the recording
    // shortcut — SESSION_START now always classifies the plain recording
    // shortcut as type: 'meeting'; see src/main/ipc/transcriber.ts).
    await startDictation(mainPage, electronApp);
    await expect(
      notificationPage.locator('text=recording').first(),
      'should show notification window with "Recording" message',
    ).toBeVisible();

    // Substitute a canned transcript for the real Whisper output — must be
    // set before mountMockAudioChunks triggers transcription below.
    await mockTranscript(mainPage, MOCK_TRANSCRIPT);

    // Mock audio data
    await mountMockAudioChunks(mainPage, 'fairy-tails-story.mp3');

    // STEP 3: Stop dictation → process audio to transcript
    await stopDictation(mainPage, electronApp);

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

    // Restore real transcription so a leaked mock can't affect a later spec
    // sharing this same Electron process.
    await mockTranscript(mainPage, null);
  });
});
