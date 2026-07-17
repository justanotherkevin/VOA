/**
 * Reproduces the reported "app freezes on base/small/medium Whisper models"
 * bug inside the real Electron app (not an isolated Node harness).
 *
 * Method: while transcriberService processes the_time_has_come.mp3 through
 * the real e2e-transcribe-file IPC path (same TranscriberService.transcribe()
 * call the production VAD-segment flow uses), a second loop inside the
 * SAME renderer process concurrently pings a cheap IPC channel
 * (modelPreferences:get) every ~50ms. Renderer JS itself never blocks main
 * (separate OS process) — but every ipcRenderer.invoke() has to be serviced
 * by the main process's single event loop. If Whisper inference blocks that
 * loop, the ping round-trips will stall for the exact duration of the block,
 * which is directly observable as latency spikes below.
 */
import path from 'path';
import { test, expect } from './fixtures';

const AUDIO_FILE = path.resolve(__dirname, 'mocks/the_time_has_come.mp3');

async function runFreezeProbe(page: any, model: string, quantized: boolean) {
  await page.evaluate(
    async ({
      selectedModel,
      quantized: q,
    }: {
      selectedModel: string;
      quantized: boolean;
    }) => {
      await (window as any).electronAPI.settings.model.update({
        selectedModel,
        multilingual: false,
        quantized: q,
      });
    },
    { selectedModel: model, quantized },
  );

  const result = await page.evaluate(
    async ({ filePath }: { filePath: string }) => {
      const pingLatencies: number[] = [];
      let running = true;

      const pingLoop = (async () => {
        while (running) {
          const start = performance.now();
          // eslint-disable-next-line no-await-in-loop
          await (window as any).electronAPI.settings.model.get();
          pingLatencies.push(performance.now() - start);
          // eslint-disable-next-line no-await-in-loop
          await new Promise((r) => setTimeout(r, 50));
        }
      })();

      const transcribeStart = performance.now();
      await (window as any).__e2eTestAPI.transcribeFileForTest(filePath);
      const transcribeDurationMs = performance.now() - transcribeStart;

      running = false;
      await pingLoop;

      // The e2e-transcribe-file IPC handler swallows transcription errors
      // internally (TranscriberService.transcribe() catches and returns
      // null rather than rejecting) — the call resolving quickly is NOT
      // proof of success; it resolves just as fast on a crash. Checking the
      // actual saved meeting is the only real signal.
      const meetings = await (window as any).electronAPI.meetings.getAll();
      const transcript = meetings[0]?.transcript ?? '';

      return { transcribeDurationMs, pingLatencies, transcript };
    },
    { filePath: AUDIO_FILE },
  );

  return result as {
    transcribeDurationMs: number;
    pingLatencies: number[];
    transcript: string;
  };
}

// Small/medium (quantized or not) are known to crash the whisper process
// 100% of the time — a confirmed onnxruntime-node bug, not a flake. See
// docs/whisper-onnxruntime-crash.md. Kept as test.fixme rather than deleted
// so this suite starts failing loudly (Playwright flags a fixme that
// unexpectedly passes) the moment that bug is fixed upstream or Whisper
// moves off onnxruntime-node — that's the signal to re-enable them.
const KNOWN_CRASHING = new Set([
  'small',
  'small-quantized',
  'medium',
  'medium-quantized',
]);

test.describe('Whisper model — main-process freeze probe', () => {
  for (const [label, model, quantized] of [
    ['tiny', 'Xenova/whisper-tiny', false],
    ['small', 'Xenova/whisper-small', false],
    ['small-quantized', 'Xenova/whisper-small', true],
    ['medium', 'Xenova/whisper-medium', false],
    ['medium-quantized', 'Xenova/whisper-medium', true],
  ] as const) {
    const run = KNOWN_CRASHING.has(label) ? test.fixme : test;
    run(
      `${label} — main process ping latency during transcription`,
      async ({ page }) => {
        test.setTimeout(180_000);

        const { transcribeDurationMs, pingLatencies, transcript } =
          await runFreezeProbe(page, model, quantized);

        const maxPing = Math.max(...pingLatencies);
        const avgPing =
          pingLatencies.reduce((a, b) => a + b, 0) / pingLatencies.length;

        console.log(
          `[${label}] transcribe: ${(transcribeDurationMs / 1000).toFixed(1)}s | ` +
            `pings: ${pingLatencies.length} | avg: ${avgPing.toFixed(0)}ms | max: ${maxPing.toFixed(0)}ms | ` +
            `transcript: ${transcript ? `"${transcript.slice(0, 80)}..."` : '(EMPTY — transcription failed)'}`,
        );

        expect(transcript.length).toBeGreaterThan(0);
      },
    );
  }
});
