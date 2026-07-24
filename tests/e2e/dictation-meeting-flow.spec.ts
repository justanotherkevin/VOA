/**
 * E2E tests: Meeting recording and enrichment pipeline
 *
 * Test 1 — Mock enrichment (fast, ~2 min):
 *   Mirrors dictation-flow.spec.ts. Records city-meeting-short.mp3, forces isMeeting,
 *   injects mock Qwen output via __e2eTestAPI.mockEnrichMeeting(), and verifies the
 *   structured summary UI renders (Key Decisions / Topics / Action Items).
 *
 * Test 2 — Real Qwen enrichment (slow, ~5–15 min on CPU):
 *   Seeds a meeting directly with the transcript from city-meeting-transcript-2.json
 *   (whisper-medium.en output), then clicks "Meeting details" to trigger the actual
 *   Qwen pipeline. Verifies the model produces valid structured output and the UI
 *   renders it. Requires the Qwen model to be cached in ~/.cache/huggingface/hub/.
 *
 * Test 3 — Rolling Qwen enrichment (slow, ~5–15 min on CPU):
 *   Calls submitChunk() directly for each 5-min window of city-meeting-transcript-2.json,
 *   mirroring the chunk timer in useRecordingFlow.ts. Verifies rolling accumulation
 *   across 3 chunks (each chunk builds on the previous summary).
 */

import path from 'path';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import os from 'node:os';

// When a revision is pinned in the pipeline() call, transformers.js stores files
// under a revision-specific subdirectory instead of directly under the model root.
const QWEN_MODEL_PATH = resolve(
  os.homedir(),
  '.cache/huggingface/hub/onnx-community/Qwen2.5-1.5B-Instruct/94677ac90364afdc2b476788d085a9680efde737/onnx/model_quantized.onnx',
);
import { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import {
  startRecording,
  stopRecording,
} from './utils/dictation/recording-actions';
import { mountMockAudioChunks } from './utils/dictation/hardware-mocks';
import { getVisibleWindows } from './utils/common.helpers';
import {
  getMeetings,
  mockEnrichMeeting,
  seedMeeting,
} from './utils/seed.helpers';

const TRANSCRIPT_FILE = resolve(
  __dirname,
  'mocks/city-meeting-transcript-2.json',
);
const CHUNK_DURATION_S = 5 * 60; // matches CHUNK_INTERVAL_MS in useRecordingFlow.ts
const MAX_DELTA_CHARS = 6000; // matches MAX_DELTA_CHARS in structured-summarizer.ts

interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

function buildTranscriptFromJSON() {
  const data = JSON.parse(readFileSync(TRANSCRIPT_FILE, 'utf-8'));
  const segments: TranscriptSegment[] = data.segments;
  const transcript = segments
    .map((s) => s.text)
    .join(' ')
    .trim();
  const durationMs = Math.round(data.duration_s * 1000);
  return { transcript, durationMs, segments, durationS: data.duration_s };
}

test.describe('Meeting Dictation Flow', () => {
  let mainPage: Page;
  let notificationPage: Page;

  test.beforeEach(async ({ electronApp }) => {
    const { main, notification } = await getVisibleWindows(electronApp);
    mainPage = main;
    notificationPage = notification;
  });

  test('enriches city-meeting with summary, decisions, topics, and action items; MOCK Structure Summary data', async ({
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
      notificationPage.locator('text=recording').first(),
      'should show notification window with "Recording" message',
    ).toBeVisible({ timeout: 5_000 });

    // STEP 3: Inject meeting audio
    await mountMockAudioChunks(mainPage, 'city-meeting-short.mp3');

    // STEP 4: Stop recording → Whisper transcribes → summaryStatus:'not-started'
    await stopRecording(mainPage, electronApp);

    // STEP 5: Wait for the meeting to appear in the list.
    // With on-demand enrichment, summaryStatus is 'not-started' after transcription —
    // the spinner only shows once the user explicitly triggers enrichment.
    // The test injects mock enrichment directly (Step 6) rather than clicking "Enrich".
    await expect(
      mainPage.locator('text=No meetings yet'),
      'meeting should have appeared in the list',
    ).not.toBeVisible({ timeout: 5_000 });

    const [seededMeeting] = await getMeetings(mainPage);
    expect(
      seededMeeting.type === 'meeting',
      'recording should be classified as a meeting',
    ).toBe(true);

    // STEP 6: Inject mock enrichment results via test-only IPC handler.
    // The real Qwen model (onnx-community/Qwen2.5-1.5B-Instruct) is not downloaded
    // in E2E test runs. The mock bypasses the native model while still exercising
    // the full store-update → IPC → MeetingDetail UI rendering path.
    await mockEnrichMeeting(mainPage);

    // STEP 7: Verify enrichment sections render after summaryStatus → 'ready'
    await expect(
      mainPage.locator('text=Key Decisions'),
      'Key Decisions section should be visible',
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      mainPage.locator('text=Action Items'),
      'Action Items section should be visible',
    ).toBeVisible({ timeout: 15_000 });

    // Topics now lives under the Participants tab. Exact match — "text=Topics"
    // also matches the "Participants & Topics" section heading.
    await mainPage.getByRole('tab', { name: 'Participants' }).click();
    await expect(
      mainPage.getByText('Topics', { exact: true }),
      'Topics section should be visible',
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

  test('seeds meeting from transcript JSON and enriches with real Qwen via "Meeting details"', async ({
    electronApp,
  }) => {
    test.skip(
      !existsSync(QWEN_MODEL_PATH),
      'Qwen model not cached — run the app and download the model from Settings first',
    );

    test.setTimeout(10 * 60 * 1000); // Qwen model load + inference ~5–15 min on CPU
    mainPage.setDefaultTimeout(10 * 60 * 1000);

    const now = Date.now();
    const { transcript, durationMs } = buildTranscriptFromJSON();
    console.log(`\n[Qwen E2E] Transcript: ${transcript.length} chars`);

    const meeting = await seedMeeting(mainPage, {
      title: 'City Community Board Meeting',
      startedAt: now - durationMs,
      endedAt: now,
      durationMs,
      type: 'meeting',
      summaryStatus: 'not-started',
      transcript,
      chunks: [],
      summary: '',
      decisions: [],
      topics: [],
      actionItems: [],
      audioSource: 'mic',
      participants: [],
      tags: [],
    });
    console.log(`[Qwen E2E] Meeting seeded: ${meeting.id}`);

    // Pipe renderer console + summarizer IPC events into test output so we
    // can see Qwen progress without checking the terminal manually.
    mainPage.on('console', (msg) =>
      console.log(`[renderer:${msg.type()}] ${msg.text()}`),
    );
    await mainPage.evaluate(() => {
      const api = (window as any).electronAPI?.summarizer;
      if (!api) return;
      api.on.progress((data: any) =>
        console.log('[Qwen progress]', JSON.stringify(data)),
      );
      api.on.ready(() => console.log('[Qwen ready] model loaded'));
      api.on.error((err: any) => console.log('[Qwen error]', String(err)));
    });

    await expect(
      mainPage.getByRole('heading', { name: 'City Community Board Meeting' }),
      'seeded meeting should appear in the list',
    ).toBeVisible({ timeout: 10_000 });

    // Button visible only when type='meeting' && summaryStatus=not-started && summarizerReady
    // summarizerReady is set by Meetings.tsx checking the HF model cache on mount
    await expect(
      mainPage.getByRole('button', { name: 'Meeting details' }),
      '"Meeting details" button requires Qwen model cached in ~/.cache/huggingface/hub/',
    ).toBeVisible({ timeout: 10_000 });

    console.log(
      '[Qwen E2E] Clicking "Meeting details" — Qwen inference starting...',
    );
    await mainPage.locator('text=Meeting details').click();

    // Poll summaryStatus every 15 s so we can see it move pending → ready/failed
    // without waiting the full 15-min timeout in silence.
    let pollActive = true;
    const statusPoller = (async () => {
      while (pollActive) {
        await new Promise((r) => setTimeout(r, 15_000));
        if (!pollActive) break;
        const all = await getMeetings(mainPage);
        const m = all.find((x) => x.id === meeting.id);
        console.log(
          `[Qwen E2E] summaryStatus=${m?.summaryStatus ?? 'unknown'}`,
        );
        if (m?.summaryStatus === 'ready' || m?.summaryStatus === 'failed')
          break;
      }
    })();

    await expect(
      mainPage.locator('text=Key Decisions'),
      'Key Decisions section should appear after real Qwen enrichment',
    ).toBeVisible({ timeout: 15 * 60 * 1000 });
    pollActive = false;
    await statusPoller;

    await expect(mainPage.locator('text=Action Items')).toBeVisible({
      timeout: 30_000,
    });

    // Topics now lives under the Participants tab. Exact match — "text=Topics"
    // also matches the "Participants & Topics" section heading.
    await mainPage.getByRole('tab', { name: 'Participants' }).click();
    await expect(mainPage.getByText('Topics', { exact: true })).toBeVisible({
      timeout: 30_000,
    });

    const enriched = await getMeetings(mainPage);
    const updated = enriched.find((m) => m.id === meeting.id);
    expect(updated!.summaryStatus).toBe('ready');
    expect(updated!.summary.length).toBeGreaterThan(0);
    expect(updated!.topics.length).toBeGreaterThan(0);

    console.log(
      '\n[Qwen E2E] ══ Real Qwen output ══════════════════════════════',
    );
    console.log('[Qwen E2E] Summary:', updated!.summary);
    console.log('[Qwen E2E] Decisions:', updated!.decisions);
    console.log('[Qwen E2E] Topics:', updated!.topics);
    console.log(
      '[Qwen E2E] Action items:',
      updated!.actionItems.map((a) => a.text),
    );
  });

  // test('replays 5-min submitChunk() calls from transcript JSON using real Qwen', async () => {
  //   test.setTimeout(25 * 60 * 1000);
  //   mainPage.setDefaultTimeout(5 * 60 * 1000);

  //   const { segments, durationS } = buildTranscriptFromJSON();
  //   const numWindows = Math.ceil(durationS / CHUNK_DURATION_S);

  //   const deltas = Array.from({ length: numWindows }, (_, w) => {
  //     const start = w * CHUNK_DURATION_S;
  //     const end = start + CHUNK_DURATION_S;
  //     return segments
  //       .filter((s) => s.start >= start && s.start < end)
  //       .map((s) => s.text)
  //       .join(' ')
  //       .trim()
  //       .slice(0, MAX_DELTA_CHARS);
  //   });

  //   console.log(
  //     `\n[Rolling E2E] ${numWindows} chunks: ${deltas.map((d, i) => `chunk${i + 1}=${d.length}chars`).join(', ')}`,
  //   );

  //   // Reset rolling state so chunk 1 uses the single-pass prompt (no previousSummary)
  //   await mainPage.evaluate(
  //     (ts: number) => (window as any).electronAPI.transcriber.startSession(ts),
  //     Date.now(),
  //   );

  //   const summaries: Array<{
  //     summary: string;
  //     decisions: string[];
  //     topics: string[];
  //     actionItems: Array<{ text: string; done: boolean }>;
  //   }> = [];

  //   for (let i = 0; i < deltas.length; i++) {
  //     const label = `Chunk ${i + 1}/${numWindows}`;
  //     console.log(
  //       `[Rolling E2E] ${label} — ${deltas[i].length} chars (${i === 0 ? 'single-pass' : 'rolling + previousSummary'})`,
  //     );

  //     const response: {
  //       success: boolean;
  //       result: (typeof summaries)[0] | null;
  //     } = await mainPage.evaluate(
  //       async (delta: string) =>
  //         (window as any).electronAPI.summarizer.submitChunk(delta),
  //       deltas[i],
  //     );

  //     expect(response.success).toBe(true);
  //     expect(response.result).not.toBeNull();
  //     expect(response.result!.summary.length).toBeGreaterThan(0);
  //     summaries.push(response.result!);

  //     console.log(
  //       `[Rolling E2E] ${label} → topics: ${response.result!.topics.length}, decisions: ${response.result!.decisions.length}`,
  //     );
  //   }

  //   const final = summaries[summaries.length - 1];
  //   expect(final.topics.length).toBeGreaterThan(0);
  //   if (summaries.length >= 2) {
  //     expect(final.topics.length).toBeGreaterThanOrEqual(
  //       summaries[0].topics.length,
  //     );
  //   }

  //   console.log(
  //     '\n[Rolling E2E] ══ Final rolling summary ══════════════════════',
  //   );
  //   console.log('[Rolling E2E] Summary:', final.summary);
  //   console.log('[Rolling E2E] Topics:', final.topics);
  //   console.log('[Rolling E2E] Decisions:', final.decisions);
  // });
});
