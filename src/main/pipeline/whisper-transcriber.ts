/* eslint-disable camelcase */
import path from 'path';
import { utilityProcess, UtilityProcess } from 'electron';
import { log } from 'electron-log';
import { AsrTranscriber, TranscriptionResult } from './types';

// Model load (ONNX weight prepacking) and inference both happen in
// whisper-process.ts, isolated in a utilityProcess child — see that file and
// docs/whisper-onnxruntime-crash.md for why (a known onnxruntime-node
// issue can hang or SIGTRAP-crash on base/small/medium models; a
// worker_thread can't contain that since it shares the main process's
// address space, a utilityProcess can). Everything routed through this
// class runs one job at a time via an explicit FIFO queue: only one child
// process exists, and a new job is never posted to it until the previous
// one has resolved.
interface QueueItem {
  id: number;
  message: Record<string, unknown>;
  resolve: (msg: any) => void;
  reject: (err: Error) => void;
  onProgress?: (data: any) => void;
}

class WhisperTranscriber implements AsrTranscriber {
  private child: UtilityProcess | null = null;
  private queue: QueueItem[] = [];
  private inFlight: QueueItem | null = null;
  private nextId = 0;

  private currentModel: string | null = null;
  private currentQuantized: boolean | null = null;
  private isInitialized = false;

  private pendingInitPromise: Promise<void> | null = null;
  private pendingInitKey: string | null = null;
  private disposing = false;

  // Overridable in tests to avoid spawning a real child process.
  _processFactory: (scriptPath: string) => UtilityProcess = (scriptPath) =>
    utilityProcess.fork(scriptPath, [], { serviceName: 'whisper-transcriber' });

  private getChild(): UtilityProcess {
    if (this.child) return this.child;

    const scriptPath = path.join(__dirname, 'whisper-process.js');
    const child = this._processFactory(scriptPath);

    child.on('message', (msg: any) => this.handleChildMessage(msg));
    child.on('exit', (code: number) => {
      this.child = null;
      if (code !== 0 && !this.disposing) {
        this.handleChildFailure(
          new Error(`Whisper process exited unexpectedly (code=${code})`),
        );
      }
    });

    this.child = child;
    return child;
  }

  private handleChildMessage(msg: any): void {
    const item = this.inFlight;
    if (!item || msg.id !== item.id) return;

    if (msg.type === 'progress') {
      item.onProgress?.(msg.data);
      return;
    }

    this.inFlight = null;

    if (msg.type === 'error') {
      item.reject(new Error(msg.message));
    } else {
      item.resolve(msg);
    }

    this.processNext();
  }

  private handleChildFailure(err: Error): void {
    log('[WhisperTranscriber] Child process failure:', err);
    this.isInitialized = false;
    this.currentModel = null;
    this.currentQuantized = null;

    const failed = this.inFlight ? [this.inFlight, ...this.queue] : this.queue;
    this.inFlight = null;
    this.queue = [];
    failed.forEach((item) => item.reject(err));

    this.child = null;
  }

  private enqueue(
    message: Record<string, unknown>,
    onProgress?: (data: any) => void,
  ): Promise<any> {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.queue.push({
        id,
        message: { ...message, id },
        resolve,
        reject,
        onProgress,
      });
      this.processNext();
    });
  }

  private processNext(): void {
    if (this.inFlight || this.queue.length === 0) return;
    const item = this.queue.shift()!;
    this.inFlight = item;
    this.getChild().postMessage(item.message);
  }

  async initialize(
    model: string,
    quantized: boolean,
    progressCallback?: (data: any) => void,
  ): Promise<void> {
    const key = `${model}:${quantized}`;

    if (
      this.isInitialized &&
      key === `${this.currentModel}:${this.currentQuantized}`
    ) {
      return;
    }

    if (this.pendingInitPromise && key === this.pendingInitKey) {
      return this.pendingInitPromise;
    }

    this.pendingInitKey = key;
    log('[WhisperTranscriber] Queuing initialize for model:', model);

    this.pendingInitPromise = (async () => {
      await this.enqueue(
        { type: 'initialize', model, quantized },
        progressCallback,
      );
      this.currentModel = model;
      this.currentQuantized = quantized;
      this.isInitialized = true;
      log('[WhisperTranscriber] Pipeline initialized successfully');
    })();

    try {
      await this.pendingInitPromise;
    } catch (error) {
      log('[WhisperTranscriber] Failed to initialize pipeline:', error);
      throw error;
    } finally {
      this.pendingInitPromise = null;
      this.pendingInitKey = null;
    }
  }

  async transcribe(
    audioBuffer: Float32Array,
    subtask: string,
  ): Promise<TranscriptionResult> {
    if (!this.isInitialized) {
      throw new Error('WhisperTranscriber not initialized');
    }

    try {
      const result = await this.enqueue({
        type: 'transcribe',
        audioBuffer,
        subtask,
      });
      return {
        chunks: result.chunks || [],
        duration_in_seconds: result.duration_in_seconds || 0,
      };
    } catch (error) {
      log('[WhisperTranscriber] Transcription error:', error);
      throw error;
    }
  }

  async dispose(): Promise<void> {
    const abandoned = this.inFlight
      ? [this.inFlight, ...this.queue]
      : this.queue;
    this.inFlight = null;
    this.queue = [];
    abandoned.forEach((item) =>
      item.reject(new Error('WhisperTranscriber disposed')),
    );

    if (this.child) {
      this.disposing = true;
      this.child.kill();
      this.child = null;
      this.disposing = false;
    }

    this.isInitialized = false;
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
