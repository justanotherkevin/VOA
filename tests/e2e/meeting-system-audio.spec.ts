/**
 * E2E: a meeting session captures SYSTEM (speaker/loopback) audio.
 *
 * Plays a real mp3 through the Mac speakers with `afplay` while a meeting is
 * recording, then checks that non-silent system-source chunks reached the
 * transcriber (observed via the E2E-only audio stats in transcriber.e2e.ts) and
 * that the saved meeting is tagged with a system audio source. Whisper is
 * mocked: this checks capture plumbing, not transcription accuracy.
 *
 * Requires macOS 14+, audible output, and the "Screen & System Audio
 * Recording" permission for the Electron binary / the terminal running the test.
 */
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { test, expect } from './fixtures';
import { startRecording, stopRecording } from './utils/dictation/recording-actions';
import { getVisibleWindows, pollUntil } from './utils/common.helpers';
import { getMeetings, mockTranscript } from './utils/seed.helpers';

test.skip(process.platform !== 'darwin', 'system audio loopback is macOS only');

const SPEECH_FILE = resolve(__dirname, 'mocks/city-meeting-short.mp3');
const PLAY_SECONDS = 12;

test('meeting captures non-silent system audio', async ({ electronApp }) => {
  test.setTimeout(90_000);
  const { main } = await getVisibleWindows(electronApp);

  const consoleLines: string[] = [];
  main.on('console', (m) => consoleLines.push(m.text()));

  await mockTranscript(main, 'system audio plumbing check');
  await startRecording(main, electronApp, { isMeeting: true });

  const player = spawn('afplay', ['-t', String(PLAY_SECONDS), SPEECH_FILE]);
  try {
    await pollUntil(
      async () =>
        (await main.evaluate(() => (window as any).__e2eTestAPI.getAudioStats()))
          .system.chunks > 0,
      PLAY_SECONDS * 1000,
    ).catch(() => undefined);

    const stats = await main.evaluate(() =>
      (window as any).__e2eTestAPI.getAudioStats(),
    );
    console.log('[meeting-system-audio] stats', JSON.stringify(stats));

    expect(
      consoleLines.filter((l) =>
        /system audio unavailable|startSystemAudio failed/.test(l),
      ),
      'startSystemAudio should return true',
    ).toEqual([]);
    expect(stats.system.chunks, 'system chunks reached main').toBeGreaterThan(0);
    expect(stats.system.peak, 'system audio is not silent').toBeGreaterThan(0.01);
  } finally {
    player.kill();
    await stopRecording(main, electronApp);
  }

  const [meeting] = await getMeetings(main);
  expect(['system', 'both']).toContain(meeting?.audioSource);
});
