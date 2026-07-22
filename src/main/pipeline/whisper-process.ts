/* eslint-disable camelcase */
// Runs as a utilityProcess.fork() child — isolated from Electron's
// main/renderer/GPU processes, both in address space and OS process
// lifecycle. This isolation means a native crash here can't take the whole
// app down (see docs/whisper-onnxruntime-crash.md for why that mattered).
// Communication uses process.parentPort (MessagePort).

// Base/Small/Medium reliably SIGTRAP-crash (or hang) during ONNX weight
// load — a BFCArena allocator bug in onnxruntime-node, filed upstream at
// https://github.com/microsoft/onnxruntime/issues/29763. Disabling the CPU
// memory arena and forcing single-threaded/sequential execution measurably
// reduces how easily it triggers (passes reliably in isolation) but does
// NOT eliminate it — it still reproduced under realistic sequential use on
// a memory-constrained machine (see docs/whisper-onnxruntime-crash.md,
// "Tried: disabling the CPU memory arena"). Kept because it's a genuine
// improvement, not because it's sufficient on its own — Base/Small/Medium
// stay disabled in Settings (src/lib/Constants.ts) until something
// eliminates the crash rather than narrowing its window.
// @xenova/transformers@2.17.2's pipeline() API has no session-options
// passthrough, so this patches the exact onnxruntime-node instance it
// resolves internally (its own nested node_modules copy) before any
// session gets created.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  InferenceSession,
} = require('@xenova/transformers/node_modules/onnxruntime-node');
const _originalCreate = InferenceSession.create.bind(InferenceSession);
InferenceSession.create = function patchedCreate(...args: any[]) {
  const last = args[args.length - 1];
  if (
    last &&
    typeof last === 'object' &&
    !Buffer.isBuffer(last) &&
    !ArrayBuffer.isView(last)
  ) {
    args[args.length - 1] = {
      ...last,
      enableCpuMemArena: false,
      enableMemPattern: false,
      executionMode: 'sequential',
      intraOpNumThreads: 1,
      interOpNumThreads: 1,
    };
  }
  return _originalCreate(...args);
};

let transcriber: any = null;
let currentModel: string | null = null;
let currentQuantized: boolean | null = null;

process.parentPort.on('message', async ({ data: msg }: { data: any }) => {
  const { id, type } = msg;

  try {
    if (type === 'initialize') {
      const { model, quantized } = msg;

      if (
        transcriber &&
        model === currentModel &&
        quantized === currentQuantized
      ) {
        process.parentPort.postMessage({ id, type: 'initialized' });
        return;
      }

      if (transcriber) {
        transcriber.dispose?.();
        transcriber = null;
      }

      const loadStart = Date.now();
      let firstProgressAt: number | null = null;

      const { pipeline } = await import('@xenova/transformers');
      transcriber = await pipeline('automatic-speech-recognition', model, {
        quantized,
        progress_callback: (data: any) => {
          if (firstProgressAt === null) {
            firstProgressAt = Date.now();
            process.parentPort.postMessage({
              type: 'log',
              message: `time-to-first-progress model=${model} quantized=${quantized}: ${firstProgressAt - loadStart}ms`,
            });
          }
          process.parentPort.postMessage({ id, type: 'progress', data });
        },
        revision: model.includes('/whisper-medium') ? 'no_attentions' : 'main',
      });

      process.parentPort.postMessage({
        type: 'log',
        message: `load complete model=${model} quantized=${quantized}: ${Date.now() - loadStart}ms total`,
      });

      currentModel = model;
      currentQuantized = quantized;
      process.parentPort.postMessage({ id, type: 'initialized' });
      return;
    }

    if (type === 'transcribe') {
      if (!transcriber) {
        throw new Error('WhisperTranscriber not initialized');
      }

      const { audioBuffer, subtask } = msg;
      const inferenceStart = Date.now();
      const output = await transcriber(audioBuffer, {
        top_k: 0,
        do_sample: false,
        chunk_length_s: 30,
        stride_length_s: 5,
        task: subtask,
        return_timestamps: true,
        force_full_sequences: false,
      });
      process.parentPort.postMessage({
        type: 'log',
        message: `inference complete model=${currentModel} quantized=${currentQuantized}: ${Date.now() - inferenceStart}ms`,
      });

      if (!output) {
        throw new Error('Transcription failed: no output');
      }

      process.parentPort.postMessage({
        id,
        type: 'result',
        chunks: output.chunks || [],
        duration_in_seconds: output.duration_in_seconds || 0,
      });
    }
  } catch (error) {
    process.parentPort.postMessage({
      id,
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
