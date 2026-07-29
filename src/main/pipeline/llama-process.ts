/* eslint-disable camelcase */
// Runs as a utilityProcess.fork() child — isolated from Electron's
// main/renderer/GPU processes, matching whisper-process.ts's isolation
// rationale (see docs/whisper-onnxruntime-crash.md). Confirmed via a real
// utilityProcess.fork() smoke test (not just unit-mocked) that
// node-llama-cpp's native Metal binding loads and runs a completion inside
// this sandbox — see the Phase 1 worker report for the smoke-test transcript.
// Communication uses process.parentPort (MessagePort).
//
// node-llama-cpp is ESM-only; this file compiles to CJS (like the rest of
// src/main/), so it must be imported dynamically rather than via a static
// import, same as whisper-process.ts's dynamic import of
// @xenova/transformers.

import type {
  Llama,
  LlamaChatSession,
  LlamaContext,
} from 'node-llama-cpp' with { 'resolution-mode': 'import' };

let llama: Llama | null = null;
let context: LlamaContext | null = null;
let session: LlamaChatSession | null = null;
let currentModelPath: string | null = null;

process.parentPort.on('message', async ({ data: msg }: { data: any }) => {
  const { id, type } = msg;

  try {
    if (type === 'initialize') {
      const { modelPath } = msg;

      if (session && modelPath === currentModelPath) {
        process.parentPort.postMessage({ id, type: 'initialized' });
        return;
      }

      if (session) {
        session.dispose();
        session = null;
      }
      if (context) {
        await context.dispose();
        context = null;
      }

      const { getLlama, LlamaChatSession: LlamaChatSessionCtor } =
        await import('node-llama-cpp');

      const loadStart = Date.now();
      llama = llama ?? (await getLlama());
      const model = await llama.loadModel({ modelPath });
      context = await model.createContext();
      session = new LlamaChatSessionCtor({
        contextSequence: context.getSequence(),
      });

      process.parentPort.postMessage({
        type: 'log',
        message: `load complete modelPath=${modelPath} gpu=${llama.gpu}: ${Date.now() - loadStart}ms`,
      });

      currentModelPath = modelPath;
      process.parentPort.postMessage({ id, type: 'initialized' });
      return;
    }

    if (type === 'summarize') {
      if (!session) {
        throw new Error('LlamaSummarizer not initialized');
      }

      const { prompt } = msg;
      const inferenceStart = Date.now();
      // Each call is an independent extraction task (any prior-summary
      // context is embedded in the prompt text itself, not chat history) —
      // reset so unrelated calls never see each other's turns.
      session.resetChatHistory();
      const text = await session.prompt(prompt);
      process.parentPort.postMessage({
        type: 'log',
        message: `inference complete: ${Date.now() - inferenceStart}ms`,
      });

      process.parentPort.postMessage({ id, type: 'result', text });
    }
  } catch (error) {
    process.parentPort.postMessage({
      id,
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
