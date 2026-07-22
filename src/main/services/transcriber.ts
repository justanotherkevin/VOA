/* eslint-disable camelcase */
import {
  saveMeeting,
  updateMeeting,
  getMeetingById,
  getModelPreferences,
  generateTitle,
  type ModelPreferences,
} from '@/main/store';
import { cleanText } from '@/main/pipeline/text-cleaner';
import { pasteTextToActiveWindow, shouldPasteText } from '@/main/util';
import { getMainWindow } from '@/main/state/volatile';
import { CHANNELS } from '@/lib/ipc-channels';
import { log } from 'electron-log';
import { whisperTranscriber } from '@/main/pipeline';
import type { AsrTranscriber } from '@/main/pipeline';
import {
  AsrFactory,
  type AsrModelConfig,
  type AsrType,
} from '@/main/pipeline/asr-factory';
import type { Meeting } from '@/main/store';

export interface CompletePayload {
  status: 'complete';
  task: 'automatic-speech-recognition';
  data: {
    text: string;
    chunks: unknown[];
    original_text?: string;
    cleaned_text?: string;
  };
  savedTranscript?: unknown;
  savedMeeting?: Meeting;
}

export interface TranscriberCallbacks {
  onUpdate: (data: unknown) => void;
  onProgress: (data: unknown) => void;
  onComplete: (result: CompletePayload) => void;
  onError: (message: string) => void;
  onMeetingSaved: (meeting: Meeting) => void;
  onQueued?: (data: { position: number }) => void;
}

export interface TranscribeArgs {
  audio: Float32Array | number[];
  startedAt?: number;
  endedAt?: number;
  source?: 'mic' | 'system';
}

class TranscriberService {
  private transcriber: AsrTranscriber;
  private currentAsrType: AsrType;

  private sessionActive = false;
  private sessionIsMeeting = false;
  private lastSavedMeetingId: string | null = null;
  private lastSessionMeta: {
    startedAt: number;
    endedAt: number;
    isMeeting: boolean;
    endedAtMs: number;
  } | null = null;
  private sessionSegments: Array<{
    text: string;
    startedAt: number;
    source: 'mic' | 'system';
  }> = [];
  private sessionChunks: any[] = [];
  private sessionStartedAt: number | null = null;
  private sessionSources: Set<'mic' | 'system'> = new Set();

  constructor(transcriber: AsrTranscriber = whisperTranscriber) {
    this.transcriber = transcriber;
    this.currentAsrType = 'whisper';
  }

  beginSession(startedAt: number, isMeeting = false): void {
    this.sessionActive = true;
    this.sessionIsMeeting = isMeeting;
    this.sessionStartedAt = startedAt;
    this.sessionSegments = [];
    this.sessionChunks = [];
    this.sessionSources = new Set();
    log(
      `[TranscriberService] Session started at startedAt=${startedAt} isMeeting=${isMeeting}`,
    );
  }

  async endSession(
    endedAt: number,
    callbacks: TranscriberCallbacks,
  ): Promise<void> {
    if (!this.sessionActive) {
      log('[TranscriberService] endSession called but no active session');
      return;
    }
    this.sessionActive = false;
    const isMeeting = this.sessionIsMeeting;
    this.sessionIsMeeting = false;

    // Snapshot meta for late-segment recovery before clearing state
    this.lastSessionMeta = {
      startedAt: this.sessionStartedAt!,
      endedAt,
      isMeeting,
      endedAtMs: Date.now(),
    };
    this.lastSavedMeetingId = null;

    const segments = [...this.sessionSegments].sort(
      (a, b) => a.startedAt - b.startedAt,
    );
    const allChunks = this.sessionChunks;
    const sources = new Set(this.sessionSources);

    this.sessionSegments = [];
    this.sessionChunks = [];
    this.sessionSources = new Set();

    const useBothLabels = sources.has('mic') && sources.has('system');
    const fullText = segments
      .map((seg) => {
        if (useBothLabels) {
          const label = seg.source === 'mic' ? '[Mic]' : '[Meeting]';
          return `${label} ${seg.text}`;
        }
        return seg.text;
      })
      .join(' ')
      .trim();

    let audioSource: 'mic' | 'system' | 'both' = 'mic';
    if (sources.has('mic') && sources.has('system')) audioSource = 'both';
    else if (sources.has('system')) audioSource = 'system';

    if (fullText) {
      await this.persistMeeting(
        fullText,
        allChunks,
        this.sessionStartedAt!,
        endedAt,
        callbacks,
        audioSource,
        isMeeting,
      );
    } else {
      log(
        '[TranscriberService] Session ended with no transcript, skipping save',
      );
    }

    this.sessionStartedAt = null;
    log(`[TranscriberService] Session ended at endedAt=${endedAt}`);
  }

  setTranscriber(transcriber: AsrTranscriber): void {
    this.transcriber = transcriber;
  }

  async swapTranscriber(config: AsrModelConfig): Promise<void> {
    log(`[TranscriberService] Swapping ASR to type=${config.type}`);
    await this.transcriber?.dispose?.();
    const newTranscriber = AsrFactory.createTranscriber(config);
    this.transcriber = newTranscriber;
    this.currentAsrType = config.type;
    log(`[TranscriberService] ASR swapped successfully to type=${config.type}`);
  }

  getCurrentAsrType(): AsrType {
    return this.currentAsrType;
  }

  isSessionActive(): boolean {
    return this.sessionActive;
  }

  private resolveModelConfig(preferences: ModelPreferences): {
    modelName: string;
    quantized: boolean;
    asrType: AsrType;
  } {
    let modelName = preferences.selectedModel;
    if (!preferences.multilingual && !modelName.endsWith('.en')) {
      modelName += '.en';
    }
    return {
      modelName,
      quantized: preferences.quantized,
      asrType: (preferences.asrType || 'whisper') as AsrType,
    };
  }

  // Eagerly disposes the old model (if the ASR type or model identity is
  // changing) and loads the new one, instead of waiting for the next
  // transcribe() call to do it lazily. Used by app startup preload and by
  // the Settings "save model" handler. Refuses to run while a recording
  // session is active, since swapping the underlying transcriber mid-session
  // could dispose a model that a queued/in-flight segment is depending on.
  //
  // Takes the full ModelPreferences to resolve from (not just what's
  // currently persisted in the store) so a settings-save handler can pass
  // the not-yet-persisted merged preferences and get the correct .en-suffix
  // resolution for a `multilingual` toggle that's changing in this same
  // save, rather than resolving against the stale stored value.
  async applyModelPreferences(
    preferences: ModelPreferences,
    onProgress?: (data: any) => void,
  ): Promise<{ success: boolean; message?: string }> {
    if (this.sessionActive) {
      return {
        success: false,
        message: 'Stop recording before changing the transcription model.',
      };
    }

    try {
      const { modelName, quantized, asrType } =
        this.resolveModelConfig(preferences);

      if (asrType !== this.currentAsrType) {
        log(
          `[TranscriberService] ASR type changed, swapping from currentAsrType=${this.currentAsrType} to asrType=${asrType}`,
        );
        await this.swapTranscriber({
          type: asrType,
          modelId: preferences.selectedModel,
          quantized,
        });
      }

      log(
        `[TranscriberService] Eagerly loading transcriber... model=${modelName} quantized=${quantized}`,
      );
      await this.transcriber.initialize(modelName, quantized, onProgress);
      return { success: true };
    } catch (error) {
      log('[TranscriberService] Eager model load failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Preloads whichever model is currently selected in preferences. Intended
  // to be called once at app startup as a fire-and-forget call, so the
  // model is already warm by the time the first recording starts instead of
  // loading lazily on the first transcribe() call.
  async preloadCurrentModel(
    onProgress?: (data: any) => void,
  ): Promise<{ success: boolean; message?: string }> {
    return this.applyModelPreferences(getModelPreferences(), onProgress);
  }

  private createOnUpdateCallback(callbacks: TranscriberCallbacks) {
    return (data: any) => {
      callbacks.onUpdate({
        status: 'update',
        task: 'automatic-speech-recognition',
        data,
      });
    };
  }

  private async onError(
    callbacks: TranscriberCallbacks,
    error: unknown,
  ): Promise<void> {
    try {
      callbacks.onError(error instanceof Error ? error.message : String(error));
    } catch (e) {
      log('[TranscriberService] Failed to send error message:', e);
    }
  }

  private async transcribeAudio(
    audioData: Float32Array,
    subtask: string,
    callbacks: TranscriberCallbacks,
  ): Promise<{ outputText: string; outputChunks: any[] } | null> {
    try {
      const output = await this.transcriber.transcribe(audioData, subtask);
      if (output === null) {
        log('[TranscriberService] Full audio transcription returned null');
        return null;
      }
      return {
        outputText: this.extractTextFromResult(output) || '',
        outputChunks: output.chunks || [],
      };
    } catch (error) {
      await this.onError(callbacks, error);
      return null;
    }
  }

  private async persistMeeting(
    outputText: string,
    outputChunks: any[],
    startedAt: number,
    endedAt: number,
    callbacks: TranscriberCallbacks,
    audioSource: 'mic' | 'system' | 'both' = 'mic',
    isMeeting = false,
  ): Promise<void> {
    try {
      const durationMs = endedAt - startedAt;
      const title = generateTitle(outputText);

      // TODO: generate a lightweight plain-text summary here using
      // Xenova/distilbart-xsum-6-6 or Xenova/t5-small (<500 MB, fast) and
      // store it in meeting.summary so users see something immediately.
      // Structured enrichment (decisions / topics / action items via Qwen)
      // remains on-demand via the "✨ Meeting details" button.
      const meeting = saveMeeting({
        title,
        startedAt,
        endedAt,
        durationMs,
        isMeeting,
        transcript: outputText,
        chunks: outputChunks,
        summary: '',
        summaryStatus: isMeeting ? 'not-started' : 'ready',
        decisions: [],
        topics: [],
        actionItems: [],
        audioSource,
        participants: [],
        tags: [],
      });

      this.lastSavedMeetingId = meeting.id;
      callbacks.onMeetingSaved(meeting);

      callbacks.onComplete({
        status: 'complete',
        task: 'automatic-speech-recognition',
        data: {
          text: outputText,
          original_text: outputText,
          cleaned_text: outputText,
          chunks: outputChunks,
        },
        savedTranscript: {
          id: meeting.id,
          date: meeting.startedAt,
          text: meeting.transcript,
          chunks: meeting.chunks,
        },
        savedMeeting: meeting,
      });

      log(
        `[TranscriberService] Meeting persisted meetingId=${meeting.id} isMeeting=${isMeeting}`,
      );
    } catch (error) {
      log('[TranscriberService] Error persisting meeting:', error);
      await this.onError(callbacks, error);
    }
  }

  private async recoverLateSegment(
    outputText: string,
    outputChunks: any[],
    source: 'mic' | 'system',
  ): Promise<void> {
    const LATE_WINDOW_MS = 60_000;
    const meta = this.lastSessionMeta;
    const elapsed = meta ? Date.now() - meta.endedAtMs : Infinity;

    if (elapsed >= LATE_WINDOW_MS || !meta) {
      log(
        `[TranscriberService] Dropping late ${source} segment — beyond ${LATE_WINDOW_MS / 1000}s recovery window`,
      );
      return;
    }

    if (this.lastSavedMeetingId) {
      // Session had other segments — append to the saved meeting's transcript
      const existing = getMeetingById(this.lastSavedMeetingId);
      if (existing) {
        // If this late segment's source differs from (or the meeting already
        // spans) both sources, tag it the same way endSession tags segments
        // when both mic and system audio are present, and upgrade audioSource
        // to 'both' so the header/tag rendering stay accurate.
        const bothSources =
          existing.audioSource === 'both' || existing.audioSource !== source;
        const label = source === 'mic' ? '[Mic]' : '[Meeting]';
        const taggedText = bothSources ? `${label} ${outputText}` : outputText;
        const appendedTranscript = existing.transcript
          ? `${existing.transcript} ${taggedText}`
          : taggedText;
        const patch: Partial<Meeting> = { transcript: appendedTranscript };
        if (
          existing.audioSource !== 'both' &&
          existing.audioSource !== source
        ) {
          patch.audioSource = 'both';
        }
        const updated = updateMeeting(this.lastSavedMeetingId, patch);
        if (updated) {
          getMainWindow()?.webContents.send(CHANNELS.MEETINGS.SAVED, updated);
          log(
            `[TranscriberService] Late ${source} segment appended to meeting ${this.lastSavedMeetingId}`,
          );
        }
      }
      return;
    }

    // Session ended with empty buffer — create the meeting now from this late segment
    const meeting = saveMeeting({
      title: generateTitle(outputText),
      startedAt: meta.startedAt,
      endedAt: meta.endedAt,
      durationMs: meta.endedAt - meta.startedAt,
      isMeeting: meta.isMeeting,
      transcript: outputText,
      chunks: outputChunks,
      summary: '',
      summaryStatus: meta.isMeeting ? 'not-started' : 'ready',
      decisions: [],
      topics: [],
      actionItems: [],
      audioSource: source,
      participants: [],
      tags: [],
    });
    this.lastSavedMeetingId = meeting.id;
    getMainWindow()?.webContents.send(CHANNELS.MEETINGS.SAVED, meeting);
    log(
      `[TranscriberService] Late ${source} segment — created meeting ${meeting.id} (session had empty buffer)`,
    );
  }

  async transcribe(args: TranscribeArgs, callbacks: TranscriberCallbacks) {
    const { audio, startedAt, endedAt, source = 'mic' } = args;
    const audioData = new Float32Array(audio);
    const durationSec = (audioData.length / 16000).toFixed(1);
    const now = Date.now();
    const recordingStartedAt = startedAt ?? now - audioData.length / 16;
    const recordingEndedAt = endedAt ?? now;

    log(
      `[TranscriberService] Received audio: ${audioData.length} samples (${durationSec}s)`,
    );

    try {
      const preferences = getModelPreferences();
      const {
        modelName,
        quantized,
        asrType: preferredAsrType,
      } = this.resolveModelConfig(preferences);

      if (preferredAsrType !== this.currentAsrType) {
        log(
          `[TranscriberService] ASR type changed, swapping from currentAsrType=${this.currentAsrType} to preferredAsrType=${preferredAsrType}`,
        );
        await this.swapTranscriber({
          type: preferredAsrType,
          modelId: preferences.selectedModel,
          quantized: preferences.quantized,
        });
      }

      const language =
        preferences.language !== 'auto' ? preferences.language : undefined;
      const subtask = 'transcribe';
      log(
        `[TranscriberService] Loading transcriber... model=${modelName} quantized=${quantized}`,
      );
      const initStart = Date.now();
      await this.transcriber.initialize(modelName, quantized, (data: any) => {
        callbacks.onProgress(data);
      });
      log(
        `[TranscriberService] initialize() resolved after ${Date.now() - initStart}ms`,
      );

      const queueDepth = this.transcriber.getQueueDepth?.();
      if (queueDepth !== undefined && queueDepth > 1) {
        callbacks.onQueued?.({ position: queueDepth });
      }

      const transcribeStart = Date.now();
      const result = await this.transcribeAudio(audioData, subtask, callbacks);
      log(
        `[TranscriberService] transcribeAudio() resolved after ${Date.now() - transcribeStart}ms`,
      );

      if (!result) {
        return 'Failed to transcribe audio';
      }

      const { outputText, outputChunks } = result;

      if (shouldPasteText()) {
        log(
          `[TranscriberService] Pasting text (${outputText.length} chars, session: ${this.sessionActive}): "${outputText.slice(0, 60)}${outputText.length > 60 ? '...' : ''}"`,
        );
        pasteTextToActiveWindow(outputText);
      }

      if (!this.sessionActive) {
        await this.recoverLateSegment(outputText, outputChunks, source);
        return { text: outputText, chunks: outputChunks };
      }

      this.sessionSegments.push({
        text: outputText,
        startedAt: recordingStartedAt,
        source,
      });
      this.sessionSources.add(source);
      this.sessionChunks.push(...outputChunks);
      log(
        `[TranscriberService] Segment appended to session buffer (${this.sessionSegments.length} segments so far, source: ${source})`,
      );
      callbacks.onComplete({
        status: 'complete',
        task: 'automatic-speech-recognition',
        data: { text: outputText, chunks: outputChunks },
      });

      return { text: outputText, chunks: outputChunks };
    } catch (error: any) {
      await this.onError(callbacks, error);
      return null;
    }
  }

  private extractTextFromResult(result: any): string {
    if (typeof result === 'string') return result;
    if (result && typeof result === 'object') {
      if ('text' in result) return result.text;
      if ('chunks' in result && Array.isArray(result.chunks)) {
        return result.chunks.map((c: any) => c.text || '').join(' ');
      }
    }
    return '';
  }

  dispose(): void {
    this.transcriber.dispose();
  }
}

export default new TranscriberService();
