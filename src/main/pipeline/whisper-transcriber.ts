/* eslint-disable camelcase */
import { log } from 'electron-log';
import { AsrTranscriber, TranscriptionResult } from './types';

class WhisperTranscriber implements AsrTranscriber {
  private transcriber: any = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;
  private currentModel: string | null = null;
  private currentQuantized: boolean | null = null;

  async initialize(
    model: string,
    quantized: boolean,
    progressCallback?: (data: any) => void,
  ): Promise<void> {
    const modelKey = `${model}:${quantized}`;
    const currentKey = `${this.currentModel}:${this.currentQuantized}`;

    if (modelKey === currentKey && this.isInitialized) {
      return Promise.resolve();
    }

    if (this.initializationPromise && modelKey === currentKey) {
      return this.initializationPromise;
    }

    if (this.transcriber && modelKey !== currentKey) {
      this.transcriber.dispose?.();
      this.transcriber = null;
      this.isInitialized = false;
    }

    this.initializationPromise = (async () => {
      try {
        log('[WhisperTranscriber] Initializing ASR pipeline with model:', model);
        const { pipeline } = await import('@xenova/transformers');
        this.transcriber = await pipeline(
          'automatic-speech-recognition',
          model,
          {
            quantized,
            progress_callback: progressCallback,
            revision: model.includes('/whisper-medium')
              ? 'no_attentions'
              : 'main',
          },
        );

        this.currentModel = model;
        this.currentQuantized = quantized;
        this.isInitialized = true;
        log('[WhisperTranscriber] Pipeline initialized successfully');
      } catch (error) {
        log('[WhisperTranscriber] Failed to initialize pipeline:', error);
        this.initializationPromise = null;
        throw error;
      }
    })();

    return this.initializationPromise;
  }

  async transcribe(
    audioBuffer: Float32Array,
    subtask: string,
  ): Promise<TranscriptionResult> {
    if (!this.isInitialized || !this.transcriber) {
      throw new Error('WhisperTranscriber not initialized');
    }

    try {
      const output = await this.transcriber(audioBuffer, {
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

      return {
        chunks: output.chunks || [],
        duration_in_seconds: output.duration_in_seconds || 0,
      };
    } catch (error) {
      log('[WhisperTranscriber] Transcription error:', error);
      throw error;
    }
  }

  async dispose(): Promise<void> {
    if (this.transcriber) {
      this.transcriber.dispose?.();
      this.transcriber = null;
    }
    this.isInitialized = false;
    this.initializationPromise = null;
    this.currentModel = null;
    this.currentQuantized = null;
    log('[WhisperTranscriber] Disposed');
  }

  getModelInfo(): {
    model: string | null;
    quantized: boolean | null;
    isInitialized: boolean;
  } {
    return {
      model: this.currentModel,
      quantized: this.currentQuantized,
      isInitialized: this.isInitialized,
    };
  }
}

export default new WhisperTranscriber();
