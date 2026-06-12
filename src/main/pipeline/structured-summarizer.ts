/* eslint-disable camelcase */
import path from 'path';
import { utilityProcess, app } from 'electron';
import { DEFAULT_MODELS } from '@/lib/Constants';

export interface StructuredSummaryResult {
  summary: string;
  decisions: string[];
  topics: string[];
  actionItems: Array<{ text: string; done: boolean }>;
}

const MAX_TRANSCRIPT_CHARS = 8000;
const PROMPT_TEMPLATE = `You are a meeting note assistant. Extract structured information from this meeting transcript.
Return only valid JSON matching this schema:
{
  "summary": "2-3 sentence overview",
  "decisions": ["decision 1", "decision 2"],
  "topics": ["topic 1", "topic 2"],
  "actionItems": [{"text": "task description", "done": false}]
}
Transcript:
`;

export function parseStructuredOutput(
  raw: string,
): StructuredSummaryResult | null {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return extractFieldsWithRegex(raw);

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const summary =
      typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
    if (!summary) return null;

    return {
      summary,
      decisions: Array.isArray(parsed.decisions)
        ? parsed.decisions.filter((d: unknown) => typeof d === 'string')
        : [],
      topics: Array.isArray(parsed.topics)
        ? parsed.topics.filter((t: unknown) => typeof t === 'string')
        : [],
      actionItems: Array.isArray(parsed.actionItems)
        ? parsed.actionItems
            .filter((a: unknown) => a && typeof (a as any).text === 'string')
            .map((a: any) => ({ text: a.text, done: Boolean(a.done) }))
        : [],
    };
  } catch {
    return extractFieldsWithRegex(raw);
  }
}

export function extractFieldsWithRegex(
  raw: string,
): StructuredSummaryResult | null {
  const summaryMatch = raw.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const summary = summaryMatch?.[1]?.trim() ?? '';
  if (!summary) return null;

  const decisionsMatch = raw.match(/"decisions"\s*:\s*\[([\s\S]*?)\]/);
  const decisions = decisionsMatch
    ? [...decisionsMatch[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1])
    : [];

  const topicsMatch = raw.match(/"topics"\s*:\s*\[([\s\S]*?)\]/);
  const topics = topicsMatch
    ? [...topicsMatch[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1])
    : [];

  const actionItems: Array<{ text: string; done: boolean }> = [];
  const actionItemsMatch = raw.match(/"actionItems"\s*:\s*\[([\s\S]*?)\]/);
  if (actionItemsMatch) {
    const itemMatches = actionItemsMatch[1].matchAll(
      /\{\s*"text"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"done"\s*:\s*(true|false)\s*\}/g,
    );
    for (const m of itemMatches) {
      actionItems.push({ text: m[1], done: m[2] === 'true' });
    }
  }

  return { summary, decisions, topics, actionItems };
}

type ChildMessage =
  | { type: 'progress'; data: any }
  | { type: 'initialized' }
  | { type: 'init-error'; message: string }
  | { type: 'summarize-result'; id: string; responseText: string }
  | { type: 'summarize-error'; id: string; message: string };

// Minimal interface satisfied by both UtilityProcess (production) and fake objects (tests).
interface ISummarizerProcess {
  postMessage(msg: any): void;
  on(event: 'message', handler: (msg: any) => void): this;
  on(event: 'exit', handler: (code: number | null) => void): this;
  kill(): boolean;
}

class StructuredSummarizerService {
  private child: ISummarizerProcess | null = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;
  private initResolve: (() => void) | null = null;
  private initReject: ((e: Error) => void) | null = null;
  private progressCallback: ((data: any) => void) | null = null;
  private pendingSummarize = new Map<
    string,
    {
      resolve: (r: StructuredSummaryResult | null) => void;
      reject: (e: Error) => void;
    }
  >();
  private summarizeCounter = 0;

  // Overridable in tests to avoid spawning a real child process.
  _processFactory: (scriptPath: string) => ISummarizerProcess = (scriptPath) =>
    utilityProcess.fork(scriptPath, [], { serviceName: 'qwen-summarizer' });

  private createChild(): ISummarizerProcess {
    const scriptPath = path.join(__dirname, 'structured-summarizer-process.js');
    const child = this._processFactory(scriptPath);

    // Send config as the first message so the child knows the model name etc.
    // cacheDir redirects @xenova's cache to the HF hub path that model-cache.ts
    // already monitors, so Settings correctly reflects the download state.
    const cacheDir = path.join(app.getPath('home'), '.cache', 'huggingface', 'hub');
    child.postMessage({
      type: 'config',
      modelName: DEFAULT_MODELS.text2structuredSummary,
      promptTemplate: PROMPT_TEMPLATE,
      maxChars: MAX_TRANSCRIPT_CHARS,
      cacheDir,
    });

    child.on('message', (msg: ChildMessage) => {
      switch (msg.type) {
        case 'progress':
          this.progressCallback?.(msg.data);
          break;

        case 'initialized':
          this.isInitialized = true;
          this.initResolve?.();
          this.initResolve = null;
          this.initReject = null;
          break;

        case 'init-error': {
          this.initializationPromise = null;
          const err = new Error(msg.message);
          this.initReject?.(err);
          this.initResolve = null;
          this.initReject = null;
          break;
        }

        case 'summarize-result': {
          const pending = this.pendingSummarize.get(msg.id);
          if (pending) {
            this.pendingSummarize.delete(msg.id);
            pending.resolve(parseStructuredOutput(msg.responseText));
          }
          break;
        }

        case 'summarize-error': {
          const pending = this.pendingSummarize.get(msg.id);
          if (pending) {
            this.pendingSummarize.delete(msg.id);
            pending.reject(new Error(msg.message));
          }
          break;
        }
      }
    });

    // utilityProcess exit event only provides a code (no signal parameter).
    // Any non-zero exit is treated as an unexpected crash.
    child.on('exit', (code) => {
      if (code !== 0) {
        const err = new Error(
          `Qwen process exited unexpectedly (code=${code})`,
        );
        console.error('[StructuredSummarizer]', err.message);
        this._handleChildDeath(err);
      }
    });

    return child;
  }

  private _handleChildDeath(err: Error) {
    this.initializationPromise = null;
    this.isInitialized = false;
    this.initReject?.(err);
    this.initResolve = null;
    this.initReject = null;
    for (const pending of this.pendingSummarize.values()) {
      pending.reject(err);
    }
    this.pendingSummarize.clear();
    this.child = null;
  }

  async initialize(progressCallback?: (data: any) => void): Promise<void> {
    if (progressCallback) this.progressCallback = progressCallback;
    if (this.isInitialized) {
      progressCallback?.({ status: 'ready' });
      return;
    }
    if (this.initializationPromise) return this.initializationPromise;

    this.initializationPromise = new Promise<void>((resolve, reject) => {
      this.initResolve = resolve;
      this.initReject = reject;
      if (!this.child) this.child = this.createChild();
      this.child.postMessage({ type: 'initialize' });
    });

    return this.initializationPromise;
  }

  async summarize(text: string): Promise<StructuredSummaryResult | null> {
    if (text.length < 200) {
      console.warn('[StructuredSummarizer] Text too short, skipping');
      return null;
    }

    await this.initialize();

    const id = String(++this.summarizeCounter);

    return new Promise<StructuredSummaryResult | null>((resolve, reject) => {
      this.pendingSummarize.set(id, { resolve, reject });
      this.child!.postMessage({ type: 'summarize', id, text });
    }).catch((err) => {
      console.error('[StructuredSummarizer] Inference error:', err);
      return null;
    });
  }

  dispose(): void {
    this.child?.kill();
    this.child = null;
    this.isInitialized = false;
    this.initializationPromise = null;
    this.initResolve = null;
    this.initReject = null;
    this.pendingSummarize.clear();
  }
}

export default new StructuredSummarizerService();
