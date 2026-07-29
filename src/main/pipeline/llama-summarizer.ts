/* eslint-disable camelcase */
import path from 'path';
import { app, utilityProcess, UtilityProcess } from 'electron';
import { log } from 'electron-log';

// Placeholder path for the bundled GGUF model — a future phase adds the
// actual downloader that populates this location; nothing writes here yet.
export const BUILTIN_MODEL_PATH = path.join(
  app.getPath('userData'),
  'models',
  'qwen2.5-1.5b-instruct-q4_k_m.gguf',
);

// Model load and inference both happen in llama-process.ts, isolated in a
// utilityProcess child — see that file for why (mirrors
// whisper-transcriber.ts's crash-isolation rationale). Jobs are serialized
// through an explicit FIFO queue: only one child process exists, and a new
// job is never posted to it until the previous one has resolved.
//
// Unlike Whisper, there is exactly one bundled model for the app's
// lifetime — no per-call model switching is expected. initialize() is
// idempotent when called again with the same modelPath (matches
// TranscriberService's pattern of calling initialize() defensively before
// every job). The kill-and-respawn-on-mismatch branch exists defensively,
// mirroring whisper-transcriber.ts's crash-avoidance lesson, but isn't
// expected to fire in normal use.
interface QueueItem {
  id: number;
  message: Record<string, unknown>;
  resolve: (msg: any) => void;
  reject: (err: Error) => void;
  queuedAt: number;
}

class LlamaSummarizer {
  private child: UtilityProcess | null = null;
  private queue: QueueItem[] = [];
  private inFlight: QueueItem | null = null;
  private nextId = 0;

  private currentModelPath: string | null = null;
  private isInitialized = false;

  private pendingInitPromise: Promise<void> | null = null;
  private pendingInitKey: string | null = null;
  private disposing = false;

  // Overridable in tests to avoid spawning a real child process.
  _processFactory: (scriptPath: string) => UtilityProcess = (scriptPath) =>
    utilityProcess.fork(scriptPath, [], { serviceName: 'llama-summarizer' });

  private getChild(): UtilityProcess {
    if (this.child) return this.child;

    const scriptPath = path.join(__dirname, 'llama-process.js');
    const child = this._processFactory(scriptPath);

    child.on('message', (msg: any) => this.handleChildMessage(msg));
    child.on('exit', (code: number) => {
      // this.child may already point at a newer child by the time this
      // (async) exit event fires for the old one — see
      // whisper-transcriber.ts's identical comment.
      if (this.child !== child) return;
      this.child = null;
      if (code !== 0 && !this.disposing) {
        this.handleChildFailure(
          new Error(`Llama process exited unexpectedly (code=${code})`),
        );
      }
    });

    this.child = child;
    return child;
  }

  private handleChildMessage(msg: any): void {
    if (msg.type === 'log') {
      log(`[llama-process] ${msg.message}`);
      return;
    }

    const item = this.inFlight;
    if (!item || msg.id !== item.id) return;

    this.inFlight = null;

    if (msg.type === 'error') {
      item.reject(new Error(msg.message));
    } else {
      item.resolve(msg);
    }

    this.processNext();
  }

  private handleChildFailure(err: Error): void {
    log('[LlamaSummarizer] Child process failure:', err);
    this.isInitialized = false;
    this.currentModelPath = null;

    const failed = this.inFlight ? [this.inFlight, ...this.queue] : this.queue;
    this.inFlight = null;
    this.queue = [];
    failed.forEach((item) => item.reject(err));

    this.child = null;
  }

  getQueueDepth(): number {
    return this.queue.length + (this.inFlight ? 1 : 0);
  }

  private enqueue(message: Record<string, unknown>): Promise<any> {
    const id = ++this.nextId;
    log(
      `[LlamaSummarizer] Enqueuing ${message.type} (id=${id}), queue depth now ${this.getQueueDepth() + 1}`,
    );
    return new Promise((resolve, reject) => {
      this.queue.push({
        id,
        message: { ...message, id },
        resolve,
        reject,
        queuedAt: Date.now(),
      });
      this.processNext();
    });
  }

  private processNext(): void {
    if (this.inFlight || this.queue.length === 0) return;
    const item = this.queue.shift()!;
    log(
      `[LlamaSummarizer] Dispatching ${item.message.type} (id=${item.id}) after ${Date.now() - item.queuedAt}ms in queue`,
    );
    this.inFlight = item;
    this.getChild().postMessage(item.message);
  }

  async initialize(modelPath: string): Promise<void> {
    if (this.isInitialized && modelPath === this.currentModelPath) {
      return;
    }

    if (this.pendingInitPromise && modelPath === this.pendingInitKey) {
      return this.pendingInitPromise;
    }

    this.pendingInitKey = modelPath;
    log(`[LlamaSummarizer] Queuing initialize for modelPath=${modelPath}`);
    const initStart = Date.now();

    this.pendingInitPromise = (async () => {
      if (
        this.child &&
        this.currentModelPath !== null &&
        modelPath !== this.currentModelPath
      ) {
        this.disposing = true;
        this.child.kill();
        this.child = null;
        this.disposing = false;
      }

      await this.enqueue({ type: 'initialize', modelPath });
      this.currentModelPath = modelPath;
      this.isInitialized = true;
      log(
        `[LlamaSummarizer] Initialized successfully in ${Date.now() - initStart}ms`,
      );
    })();

    try {
      await this.pendingInitPromise;
    } catch (error) {
      log('[LlamaSummarizer] Failed to initialize:', error);
      throw error;
    } finally {
      this.pendingInitPromise = null;
      this.pendingInitKey = null;
    }
  }

  async generate(prompt: string): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('LlamaSummarizer not initialized');
    }

    try {
      const result = await this.enqueue({ type: 'summarize', prompt });
      return result.text ?? '';
    } catch (error) {
      log('[LlamaSummarizer] Generation error:', error);
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
      item.reject(new Error('LlamaSummarizer disposed')),
    );

    if (this.child) {
      this.disposing = true;
      this.child.kill();
      this.child = null;
      this.disposing = false;
    }

    this.isInitialized = false;
    this.currentModelPath = null;
    log('[LlamaSummarizer] Disposed');
  }

  getModelInfo(): { modelPath: string | null; isInitialized: boolean } {
    return {
      modelPath: this.currentModelPath,
      isInitialized: this.isInitialized,
    };
  }
}

export default new LlamaSummarizer();
