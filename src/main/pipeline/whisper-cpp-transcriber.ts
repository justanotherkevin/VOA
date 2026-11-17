import { log } from 'electron-log';
import { AsrTranscriber, TranscriptionResult } from './types';
import {
  startWhisperServer,
  stopWhisperServer,
  transcribePcm,
} from './whisper-server';

const SAMPLE_RATE = 16000;

// App model ids (Constants.MODEL_META_DATA) -> ggml files. All entries are
// English-only in the UI, so the .en ggml variants are used.
const GGML_FILES: Record<string, string> = {
  'Xenova/whisper-tiny': 'ggml-tiny.en.bin',
  'Xenova/whisper-tiny.en': 'ggml-tiny.en.bin',
  'Xenova/whisper-base': 'ggml-base.en.bin',
  'Xenova/whisper-base.en': 'ggml-base.en.bin',
  'Xenova/whisper-small': 'ggml-small.en.bin',
  'Xenova/whisper-small.en': 'ggml-small.en.bin',
  'Xenova/whisper-medium': 'ggml-medium.en.bin',
  'Xenova/whisper-medium.en': 'ggml-medium.en.bin',
};

class WhisperCppTranscriber implements AsrTranscriber {
  private currentModel: string | null = null;
  private currentQuantized: boolean | null = null;
  private isInitialized = false;
  private pending = 0;

  async initialize(
    model: string,
    quantized: boolean,
    progressCallback?: (data: any) => void,
  ): Promise<void> {
    const file = GGML_FILES[model];
    if (!file) throw new Error(`No whisper.cpp model for ${model}`);
    if (this.isInitialized && this.currentModel === model) return;

    try {
      await startWhisperServer(file, progressCallback);
    } catch (error) {
      this.isInitialized = false;
      this.currentModel = null;
      log('[WhisperCppTranscriber] Failed to initialize:', error);
      throw error;
    }
    this.currentModel = model;
    this.currentQuantized = quantized; // ignored by whisper.cpp, echoed so callers' model-key check matches
    this.isInitialized = true;
  }

  async transcribe(
    audioBuffer: Float32Array,
    _subtask: string,
  ): Promise<TranscriptionResult> {
    if (!this.isInitialized) {
      throw new Error('WhisperCppTranscriber not initialized');
    }
    this.pending++;
    try {
      const segments = await transcribePcm(audioBuffer);
      return {
        chunks: segments.map((s) => ({
          timestamp: [s.start, s.end] as [number, number],
          text: s.text,
        })),
        duration_in_seconds: audioBuffer.length / SAMPLE_RATE,
      };
    } finally {
      this.pending--;
    }
  }

  async dispose(): Promise<void> {
    stopWhisperServer();
    this.isInitialized = false;
    this.currentModel = null;
    this.currentQuantized = null;
  }

  getModelInfo() {
    return {
      model: this.currentModel,
      quantized: this.currentQuantized,
      isInitialized: this.isInitialized,
    };
  }

  getQueueDepth(): number {
    return this.pending;
  }
}

export default new WhisperCppTranscriber();
