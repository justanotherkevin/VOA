/**
 * E2E test: Meeting recording and enrichment pipeline
 *
 * Mirrors dictation-flow.spec.ts. Differences:
 *  - Uses city-meeting-short.mp3 (90 s trim — renderer holds the blob in memory
 *    before sending to Whisper; the full 11-min original caused OOM)
 *  - Passes { isMeeting: true } to startRecording() which internally calls
 *    forceMeetingNextSession() so MeetingDetector classifies the session as a
 *    meeting (no real meeting app is running in tests)
 *  - Injects mock enrichment via __e2eTestAPI.mockEnrichMeeting() because
 *    onnxruntime-node@1.21 (inside @huggingface/transformers@3.8) SIGSEGV on ARM64
 *    when loading the Qwen model via HuggingFace XET streaming
 *
 * User presses shortcut → Recording starts → city-meeting-short.mp3 injected
 * → isMeeting forced true → Whisper transcribes → summaryStatus:'pending'
 * → Mock enrichment injected → summaryStatus:'ready' → MeetingDetail renders
 */

import path from 'path';
import { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import {
  startRecording,
  stopRecording,
} from './utils/dictation/recording-actions';
import { mountMockAudioChunks } from './utils/dictation/hardware-mocks';
import { getVisibleWindows } from './utils/common.helpers';
import { getMeetings, mockEnrichMeeting } from './utils/seed.helpers';

const NOT_READY_MOCKS_DIR = path.join(__dirname, 'not-ready-mocks');

test.describe('Meeting Dictation Flow', () => {
  let mainPage: Page;
  let notificationPage: Page;

  test.beforeEach(async ({ electronApp }) => {
    const { main, notification } = await getVisibleWindows(electronApp);
    mainPage = main;
    notificationPage = notification;
  });

  test('enriches city-meeting with summary, decisions, topics, and action items', async ({
    electronApp,
  }) => {
    test.setTimeout(120_000); // dominated by Whisper transcription of 90 s audio

    // STEP 1: Confirm the app starts with no meetings (store is seeded clean by fixtures)
    await expect(
      mainPage.locator('text=No meetings yet'),
      'should start with empty meetings list',
    ).toBeVisible({ timeout: 10_000 });

    // STEP 2: Start recording (isMeeting: true forces the session to be classified
    // as a meeting so Qwen enrichment is triggered after Whisper transcription)
    await startRecording(mainPage, electronApp, { isMeeting: true });
    await expect(
      notificationPage.locator('text=recording'),
      'should show notification window with "Recording" message',
    ).toBeVisible({ timeout: 5_000 });

    // STEP 3: Inject meeting audio
    await mountMockAudioChunks(
      mainPage,
      'city-meeting-short.mp3',
      NOT_READY_MOCKS_DIR,
    );

    // STEP 4: Stop recording → Whisper transcribes → summaryStatus:'pending'
    await stopRecording(mainPage, electronApp);

    // STEP 5: Wait for the meeting to appear and confirm it is in pending state.
    // The Key Decisions sidebar renders a "Generating…" spinner while
    // summaryStatus is 'pending', proving the full pending state was reached
    // before mock enrichment fires.
    await expect(
      mainPage.locator('text=No meetings yet'),
      'meeting should have appeared in the list',
    ).not.toBeVisible({ timeout: 5_000 });

    await expect(
      mainPage.locator('text=Generating…'),
      'Key Decisions sidebar should show pending spinner before enrichment',
    ).toBeVisible({ timeout: 10_000 });

    // STEP 6: Inject mock enrichment results via test-only IPC handler.
    // The real Qwen model (onnx-community/Qwen2.5-1.5B-Instruct) requires
    // onnxruntime-node and the bundled version (1.21.0 inside
    // @huggingface/transformers@3.8) crashes with SIGSEGV on ARM64 when the
    // model is loaded via HuggingFace XET streaming. The mock bypasses the
    // native model while still exercising the full store-update → IPC → UI
    // rendering path that this test is designed to validate.
    await mockEnrichMeeting(mainPage);

    // STEP 7: Verify enrichment sections render after summaryStatus → 'ready'
    await expect(
      mainPage.locator('text=Key Decisions'),
      'Key Decisions section should be visible',
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      mainPage.locator('text=Topics'),
      'Topics section should be visible',
    ).toBeVisible({ timeout: 15_000 });

    await expect(
      mainPage.locator('text=Action Items'),
      'Action Items section should be visible',
    ).toBeVisible({ timeout: 15_000 });

    // Verify each section has actual content (mock Qwen produced at least one item)
    const meetings = await getMeetings(mainPage);
    const meeting = meetings[0];

    expect(
      meeting.decisions.length,
      'mock enrichment should include at least one decision',
    ).toBeGreaterThan(0);

    expect(
      meeting.topics.length,
      'mock enrichment should include at least one topic',
    ).toBeGreaterThan(0);

    expect(
      meeting.actionItems.length,
      'mock enrichment should include at least one action item',
    ).toBeGreaterThan(0);

    expect(
      meeting.summary.length,
      'mock enrichment should include a non-empty summary',
    ).toBeGreaterThan(0);
  });
});
