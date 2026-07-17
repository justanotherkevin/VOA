/* eslint-disable camelcase */
// Runs as a utilityProcess.fork() child — isolated from Electron's
// main/renderer/GPU processes, both in address space and OS process
// lifecycle. Model load (ONNX weight prepacking) and inference for
// base/small/medium Whisper models can otherwise hang or SIGTRAP-crash
// (a known, unresolved onnxruntime-node issue — see
// docs/whisper-onnxruntime-crash.md); isolating it here means that
// failure can't take the whole app down, and this process gets a clean,
// uncontended heap instead of competing with the other Electron processes.
// Communication uses process.parentPort (MessagePort).

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

      const { pipeline } = await import('@xenova/transformers');
      transcriber = await pipeline('automatic-speech-recognition', model, {
        quantized,
        progress_callback: (data: any) =>
          process.parentPort.postMessage({ id, type: 'progress', data }),
        revision: model.includes('/whisper-medium') ? 'no_attentions' : 'main',
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
      const output = await transcriber(audioBuffer, {
        top_k: 0,
        do_sample: false,
        chunk_length_s: 30,
        stride_length_s: 5,
        task: subtask,
        return_timestamps: true,
        force_full_sequences: false,
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
