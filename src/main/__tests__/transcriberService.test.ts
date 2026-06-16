import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import transcriberService from '../services/transcriber';

// Mock dependencies
vi.mock('@/main/store', () => ({
  saveMeeting: vi.fn(() => ({ id: 'test-meeting', title: 'Test', startedAt: 0, endedAt: 0, durationMs: 0, transcript: 'test text', chunks: [], summary: '', summaryStatus: 'pending', decisions: [], topics: [], actionItems: [], audioSource: 'mic', participants: [], tags: [] })),
  updateMeeting: vi.fn((id: string, patch: any) => ({ id, ...patch })),
  getModelPreferences: vi.fn(() => ({ asrType: 'whisper' })),
  generateTitle: vi.fn((text: string) => text.split(' ').slice(0, 8).join(' ')),
}));

vi.mock('@/main/pipeline/structured-summarizer', () => ({
  default: {
    initialize: vi.fn(async () => {}),
    summarize: vi.fn(async () => ({
      summary: '[SUMMARY] processed',
      decisions: [],
      topics: [],
      actionItems: [],
    })),
  },
}));

vi.mock('@/main/pipeline/text-cleaner', () => ({
  cleanText: vi.fn((text) => text),
}));

vi.mock('@/main/util', () => ({
  pasteTextToActiveWindow: vi.fn(),
}));

vi.mock('electron-log', () => ({
  log: vi.fn(),
}));

vi.mock('@/main/pipeline', () => ({
  whisperTranscriber: {
    initialize: vi.fn(),
    transcribe: vi.fn(),
    dispose: vi.fn(),
  },
}));

vi.mock('@/main/pipeline/asr-factory', () => ({
  AsrFactory: {
    createTranscriber: vi.fn(),
  },
}));

describe('TranscriberService - Helper Methods', () => {
  const mockCallbacks = {
    onUpdate: vi.fn(),
    onProgress: vi.fn(),
    onComplete: vi.fn(),
    onError: vi.fn(),
    onMeetingSaved: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('onError', () => {
    it('should send error message via callbacks', async () => {
      const error = new Error('Test error');
      const service = transcriberService as any;
      await service.onError(mockCallbacks, error);

      expect(mockCallbacks.onError).toHaveBeenCalledWith('Test error');
    });

    it('should handle non-Error objects', async () => {
      const service = transcriberService as any;
      await service.onError(mockCallbacks, 'String error');

      expect(mockCallbacks.onError).toHaveBeenCalledWith('String error');
    });

    it('should gracefully handle callback failures', async () => {
      const failingCallbacks = {
        onError: vi.fn(() => {
          throw new Error('Callback failed');
        })
      };
      const service = transcriberService as any;

      await expect(
        service.onError(failingCallbacks, 'error'),
      ).resolves.not.toThrow();
    });
  });

  describe('transcribeAudio', () => {
    it('should transcribe full audio without VAD', async () => {
      const { whisperTranscriber } = await import('@/main/pipeline');
      const mockTranscriber = whisperTranscriber as any;

      mockTranscriber.transcribe = vi.fn(async () => ({
        text: 'full audio text',
        chunks: [{ text: 'chunk' }],
      }));

      const service = transcriberService as any;
      const audioData = new Float32Array(16000);
      const result = await service.transcribeAudio(
        audioData,
        'transcribe',
        mockCallbacks,
      );

      expect(result?.outputText).toBe('full audio text');
      expect(result?.outputChunks).toHaveLength(1);
    });

    it('should send error via IPC on failure', async () => {
      const { whisperTranscriber } = await import('@/main/pipeline');
      const mockTranscriber = whisperTranscriber as any;

      const error = new Error('Transcription error');
      mockTranscriber.transcribe = vi.fn(async () => {
        throw error;
      });

      const service = transcriberService as any;
      const audioData = new Float32Array(16000);
      const result = await service.transcribeAudio(
        audioData,
        'transcribe',
        mockCallbacks,
      );

      expect(result).toBeNull();
      expect(mockCallbacks.onError).toHaveBeenCalledWith(
        'Transcription error',
      );
    });

    it('should handle null transcription result', async () => {
      const { whisperTranscriber } = await import('@/main/pipeline');
      const mockTranscriber = whisperTranscriber as any;

      mockTranscriber.transcribe = vi.fn(async () => null);

      const service = transcriberService as any;
      const audioData = new Float32Array(16000);
      const result = await service.transcribeAudio(
        audioData,
        'transcribe',
        mockCallbacks,
      );

      expect(result).toBeNull();
    });
  });

  describe('persistMeeting', () => {
    it('saves meeting and sends completion callbacks when isMeeting=true', async () => {
      const { saveMeeting } = await import('@/main/store');

      const service = transcriberService as any;
      await service.persistMeeting(
        'test text',
        [{ text: 'chunk' }],
        1000,
        2000,
        mockCallbacks,
        'mic',
        true,
      );

      expect(saveMeeting).toHaveBeenCalledWith(
        expect.objectContaining({
          transcript: 'test text',
          durationMs: 1000,
          audioSource: 'mic',
          summaryStatus: 'not-started',
        }),
      );
      expect(mockCallbacks.onComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'complete',
          task: 'automatic-speech-recognition',
        }),
      );
    });

    it('skips structured summarizer and saves with summaryStatus ready when isMeeting=false', async () => {
      const { saveMeeting } = await import('@/main/store');
      const { default: summarizer } = await import('@/main/pipeline/structured-summarizer');

      const service = transcriberService as any;
      await service.persistMeeting(
        'test text',
        [],
        1000,
        2000,
        mockCallbacks,
        'mic',
        false,
      );

      expect(saveMeeting).toHaveBeenCalledWith(
        expect.objectContaining({ summaryStatus: 'ready' }),
      );
      expect(summarizer.summarize).not.toHaveBeenCalled();
    });

    it('does not auto-call summarizer on persist when isMeeting=true (enrichment is on-demand)', async () => {
      const { default: summarizer } = await import('@/main/pipeline/structured-summarizer');

      const service = transcriberService as any;
      await service.persistMeeting(
        'test text that is long enough',
        [],
        1000,
        2000,
        mockCallbacks,
        'mic',
        true,
      );

      await new Promise((r) => setTimeout(r, 0));
      expect(summarizer.summarize).not.toHaveBeenCalled();
    });

    it('sends error if persistence fails', async () => {
      const { saveMeeting } = await import('@/main/store');

      (saveMeeting as any).mockImplementationOnce(() => {
        throw new Error('Persistence failed');
      });

      const service = transcriberService as any;
      await service.persistMeeting('test text', [], 0, 0, mockCallbacks);

      expect(mockCallbacks.onError).toHaveBeenCalledWith('Persistence failed');
    });
  });
});
