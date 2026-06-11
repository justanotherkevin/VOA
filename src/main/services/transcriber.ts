/* eslint-disable camelcase */
import {
  saveMeeting,
  updateMeeting,
  getMeetingById,
  getModelPreferences,
  generateTitle,
} from '@/main/store';
import styleTransferService from '@/main/pipeline/style-transfer';
import structuredSummarizerService from '@/main/pipeline/structured-summarizer';
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
}

export interface TranscribeArgs {
  audio: any;
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
    log('[TranscriberService] Session started at', startedAt, '| meeting:', isMeeting);
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
    log('[TranscriberService] Session ended at', endedAt);
  }

  setTranscriber(transcriber: AsrTranscriber): void {
    this.transcriber = transcriber;
  }

  async swapTranscriber(config: AsrModelConfig): Promise<void> {
    log('[TranscriberService] Swapping ASR to:', config.type);
    await this.transcriber?.dispose?.();
    const newTranscriber = AsrFactory.createTranscriber(config);
    this.transcriber = newTranscriber;
    this.currentAsrType = config.type;
    log('[TranscriberService] ASR swapped successfully to:', config.type);
  }

  getCurrentAsrType(): AsrType {
    return this.currentAsrType;
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

  private async getStructuredSummary(text: string) {
    try {
      const win = getMainWindow();
      const sendProgress = (data: any) => {
        try { win?.webContents.send(CHANNELS.SUMMARIZER.PROGRESS, data); } catch {}
      };
      await structuredSummarizerService.initialize(sendProgress);
      const result = await structuredSummarizerService.summarize(text);
      log('[TranscriberService] Structured summarization complete');
      win?.webContents.send(CHANNELS.SUMMARIZER.READY, {});
      return result;
    } catch (error) {
      log('[TranscriberService] Error summarizing text:', error);
      const win = getMainWindow();
      try { win?.webContents.send(CHANNELS.SUMMARIZER.ERROR, String(error)); } catch {}
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

      const meeting = saveMeeting({
        title,
        startedAt,
        endedAt,
        durationMs,
        transcript: outputText,
        chunks: outputChunks,
        summary: '',
        summaryStatus: isMeeting ? 'pending' : 'ready',
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

      log('[TranscriberService] Meeting persisted:', meeting.id, '| isMeeting:', isMeeting);

      if (isMeeting) {
        this.enrichMeetingWithStructuredSummary(meeting.id, outputText);
      }
    } catch (error) {
      log('[TranscriberService] Error persisting meeting:', error);
      await this.onError(callbacks, error);
    }
  }

  private async enrichMeetingWithStructuredSummary(
    meetingId: string,
    text: string,
  ): Promise<void> {
    if (process.env.E2E_TEST === 'true') {
      // E2E tests inject mock enrichment via transcriber:e2e-mock-enrich-meeting.
      // Skip the real Qwen model: onnxruntime-node@1.21 SIGSEGVs on ARM64 when
      // loading models via HuggingFace XET streaming.
      log('[TranscriberService] E2E mode: skipping Qwen enrichment, awaiting mock injection');
      return;
    }
    try {
      const result = await this.getStructuredSummary(text);
      const updated = updateMeeting(meetingId, {
        summary: result?.summary ?? '',
        decisions: result?.decisions ?? [],
        topics: result?.topics ?? [],
        actionItems: result?.actionItems ?? [],
        summaryStatus: 'ready',
      });
      if (updated) {
        getMainWindow()?.webContents.send(CHANNELS.MEETINGS.SAVED, updated);
        log(
          '[TranscriberService] Structured summary enriched for meeting:',
          meetingId,
        );
      }
    } catch (error) {
      log('[TranscriberService] Background summarization failed:', error);
      const updated = updateMeeting(meetingId, {
        summary: '',
        summaryStatus: 'failed',
      });
      if (updated) {
        getMainWindow()?.webContents.send(CHANNELS.MEETINGS.SAVED, updated);
      }
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
        const appendedTranscript = existing.transcript
          ? `${existing.transcript} ${outputText}`
          : outputText;
        const updated = updateMeeting(this.lastSavedMeetingId, {
          transcript: appendedTranscript,
        });
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
      transcript: outputText,
      chunks: outputChunks,
      summary: '',
      summaryStatus: meta.isMeeting ? 'pending' : 'ready',
      decisions: [],
      topics: [],
      actionItems: [],
      audioSource: source,
      participants: [],
      tags: [],
    });
    this.lastSavedMeetingId = meeting.id;
    getMainWindow()?.webContents.send(CHANNELS.MEETINGS.SAVED, meeting);
    if (meta.isMeeting) {
      this.enrichMeetingWithStructuredSummary(meeting.id, outputText);
    }
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
      const preferredAsrType = (preferences.asrType || 'whisper') as AsrType;

      if (preferredAsrType !== this.currentAsrType) {
        log(
          '[TranscriberService] ASR type changed, swapping from',
          this.currentAsrType,
          'to',
          preferredAsrType,
        );
        await this.swapTranscriber({
          type: preferredAsrType,
          modelId: preferences.selectedModel,
          quantized: preferences.quantized,
        });
      }

      let modelName = preferences.selectedModel;
      if (!preferences.multilingual && !modelName.endsWith('.en')) {
        modelName += '.en';
      }
      const language =
        preferences.language !== 'auto' ? preferences.language : undefined;
      const subtask = 'transcribe';
      log(
        '[TranscriberService] Loading transcriber...',
        modelName,
        preferences.quantized,
      );
      await this.transcriber.initialize(
        modelName,
        preferences.quantized,
        (data: any) => {
          callbacks.onProgress(data);
        },
      );

      const result = await this.transcribeAudio(audioData, subtask, callbacks);

      if (!result) {
        return 'Failed to transcribe audio';
      }

      const { outputText, outputChunks } = result;

      try {
        styleTransferService.processTranscript(outputText);
      } catch (error) {
        log('[TranscriberService] Error applying style transfer:', error);
      }

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
