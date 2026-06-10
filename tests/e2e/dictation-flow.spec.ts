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

import { toggleRecording } from './utils/dictation/recording-actions';
import {
  getTranscriptHistory,
  verifyTranscriptionContent,
} from './utils/dictation/verification-utils';
import { test, expect } from './fixtures';
import { Page, ElectronApplication } from '@playwright/test';
import { mountMockAudioChunks } from './utils/dictation/hardware-mocks';

const getVisibleWindows = async (
  electronApp: ElectronApplication,
): Promise<{ main: Page; notification: Page }> => {
  let main: Page | undefined, notification: Page | undefined;
  // Wait for at least one window to be created, allows assignment of main and notification varibles
  await electronApp.firstWindow();
  // Poll until both windows exist in the app's current windows list
  await expect
    .poll(
      () => {
        const windows = electronApp.windows();
        main = windows.find((w: any) => w.url().includes('index.html'));
        notification = windows.find((w: any) =>
          w.url().includes('notification.html'),
        );
        return main && notification;
      },
      { timeout: 1_000 },
    )
    .toBeTruthy();

  if (!main || !notification)
    throw Error('Did something changed? This app suppose to have two windows');

  return { main, notification };
};

const clearTranscriptsFlow = async (page: Page) => {
  const clearResult = await page.evaluate(async () => {
    if (typeof window.electronAPI === 'undefined') {
      return 'ERROR: electronAPI not defined';
    }
    await window.electronAPI.clearTranscriptHistory();
    return 'OK';
  });
  await expect(clearResult, 'should have successfully clear history').toBe(
    'OK',
  );
};

test.describe('Dictation Workflow', () => {
  let mainPage: Page;
  let notificationPage: Page;

  test.beforeEach(async ({ electronApp }) => {
    const { main, notification } = await getVisibleWindows(electronApp);
    mainPage = main;
    notificationPage = notification;
  });

  test.afterEach(async ({ electronApp }) => {
    await electronApp.close();
  });

  test('App launches has correct dictation process', async ({
    electronApp,
  }) => {
    test.setTimeout(20_000);
    // Get visible windows from electron app
    console.log('⭐ ', !!mainPage, !!notificationPage);

    // STEP 1: App loads and clear transcript history
    await clearTranscriptsFlow(mainPage);
    let initTranscripts = await getTranscriptHistory(mainPage);
    expect(
      initTranscripts.length,
      'should have a clean transcript history',
    ).toBe(0);

    // STEP 2: User presses shortcut → Recording starts
    await toggleRecording(mainPage, electronApp);
    console.log('🟡 Toggle recording');
    await expect(
      notificationPage.locator('text=recording'),
      'should show notification window with "Recording" message',
    ).toBeVisible();

    // Add audio data
    await mountMockAudioChunks(mainPage, 'fairy-tails-story.mp3');
    console.log('🟡 Mount audio chunk');

    // STEP 3: Toggle recording -> process audio to transcript
    await toggleRecording(mainPage, electronApp);
    console.log('🟡 Toggle recording');

    // STEP 4: Verify transcription is saved in electron-store
    console.log('📍 Verifying transcription saved in electron-store...');
    const transcripts = await getTranscriptHistory(mainPage);
    // expect(transcripts).toBeDefined();
    expect(transcripts?.length).toBe(1);

    // Verify transcript contains expected keywords
    const latestTranscript = transcripts[0];
    await verifyTranscriptionContent(latestTranscript, [
      'In the ancient land of Aldoria',
      'Zephos',
      'Even the birds fell silent',
    ]);
    console.log('🎉 STEP 6 Complete - Full dictation workflow verified!');
  });

  //   test('Records and transcribes 2 audios sequentially without state pollution', async ({
  //     electronApp,
  //   }) => {
  //     test.setTimeout(20_000);
  //     await clearTranscriptsFlow(mainPage);
  //     let initTranscripts = await getTranscriptHistory(mainPage);
  //     expect(
  //       initTranscripts.length,
  //       'there should be no transcript at the start',
  //     ).toBe(0);

  //     console.log(
  //       '\n🔄 CYCLE 1: Starting first transcription...RECORDING_SHORTCUT \n',
  //     );

  //     await toggleRecording(mainPage, electronApp);
  //     console.log('🟡 Toggle recording');
  //     await expect(
  //       notificationPage.locator('text=recording'),
  //       'should show notification window with "Recording" message',
  //     ).toBeVisible();

  //     // Add audio data
  //     await mountMockAudioChunks(mainPage, 'fairy-tails-story.mp3');
  //     console.log('🟡 Mount audio chunk');
  //     // STEP 3: Toggle recording -> process audio to transcript
  //     await toggleRecording(mainPage, electronApp);
  //     // await mainPage.pause();
  //     console.log('🟡 Toggle recording');

  //     // await transcribeAudioAndWait(
  //     //   mainPage,
  //     //   notificationPage,
  //     //   'fairy-tails-story.mp3',
  //     //   'cycle 1',
  //     // );
  //     await mainPage.pause();
  //     // Verify first transcript saved
  //     let transcripts = await getTranscriptHistory(mainPage);
  //     expect(transcripts.length).toBe(1);
  //     const transcript1 = transcripts[0].text;
  //     // console.log('✅ Transcript 1 saved and verified');

  //     // ============================================================
  //     // STATE RESET CHECKPOINT
  //     // ============================================================
  //     console.log('\n📍 Verifying state reset between cycles...\n');
  //     transcripts = await getTranscriptHistory(mainPage);
  //     expect(transcripts.length).toBe(1);
  //     console.log('✅ State verified: history = 1 transcript');
  //     await mainPage.waitForTimeout(1500);

  //     // ============================================================
  //     // CYCLE 2: Second Audio (the_time_has_come.mp3)
  //     // ============================================================
  //     console.log('\n🔄 CYCLE 2: Starting second transcription...\n');
  //     await recordAndWaitForCompletion(
  //       mainPage,
  //       electronApp,
  //       notificationPage,
  //       'cycle 2',
  //     );
  //     await transcribeAudioAndWait(
  //       mainPage,
  //       notificationPage,
  //       'the_time_has_come.mp3',
  //       'cycle 2',
  //     );

  //     // Verify second transcript saved
  //     transcripts = await getTranscriptHistory(mainPage);
  //     expect(transcripts.length).toBe(2);
  //     const transcript2 = transcripts[0].text;
  //     console.log('✅ Transcript 2 saved and verified');

  //     // ============================================================
  //     // FINAL VERIFICATION
  //     // ============================================================
  //     console.log('\n✅ FINAL VERIFICATION\n');
  //     expect(transcripts.length).toBe(2);
  //     expect(transcript1).not.toBe(transcript2);

  //     expect(transcripts[0].text).toBe(transcript2);
  //     expect(transcripts[1].text).toBe(transcript1);
  //     console.log('✅ History order is correct (newest first)');

  //     console.log('\n🎉 SEQUENTIAL TRANSCRIPTION TEST PASSED!\n');
  //     console.log(`Cycle 1 text: "${transcript1.substring(0, 50)}..."`);
  //     console.log(`Cycle 2 text: "${transcript2.substring(0, 50)}..."`);
  //   });
});
