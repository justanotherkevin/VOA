import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import transcriberService from '../services/transcriber';
import { createTranscriberCallbacks } from './helpers/transcriberTestHelpers';

// Mock dependencies
vi.mock('@/main/store', () => ({
  saveMeeting: vi.fn(() => ({
    id: 'test-meeting',
    title: 'Test',
    startedAt: 0,
    endedAt: 0,
    durationMs: 0,
    transcript: 'test text',
    chunks: [],
    summary: '',
    summaryStatus: 'pending',
    decisions: [],
    topics: [],
    actionItems: [],
    audioSource: 'mic',
    participants: [],
    tags: [],
  })),
  updateMeeting: vi.fn((id: string, patch: any) => ({ id, ...patch })),
  getModelPreferences: vi.fn(() => ({ asrType: 'whisper' })),
  generateTitle: vi.fn((text: string) => text.split(' ').slice(0, 8).join(' ')),
  getMeetingById: vi.fn(() => null),
  // Consumed by beginSession()'s calendar-match lookup; returning no feedUrl
  // makes it a no-op by default (individual tests override as needed).
  getCalendarPreferences: vi.fn(() => ({ feedUrl: '' })),
}));

const mockCreateCalendarProvider = vi.fn();
vi.mock('@/main/notification-window', () => ({
  updateNotificationState: vi.fn(),
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
  CalendarProviderFactory: {
    createProvider: (...args: any[]) => mockCreateCalendarProvider(...args),
  },
}));

vi.mock('@/main/pipeline/asr-factory', () => ({
  AsrFactory: {
    createTranscriber: vi.fn(),
  },
}));

describe('TranscriberService - Helper Methods', () => {
  const mockCallbacks = createTranscriberCallbacks();

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
        }),
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
      expect(mockCallbacks.onError).toHaveBeenCalledWith('Transcription error');
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
    it('saves meeting and sends completion callbacks when type=meeting', async () => {
      const { saveMeeting } = await import('@/main/store');

      const service = transcriberService as any;
      await service.persistMeeting(
        'test text',
        [{ text: 'chunk' }],
        1000,
        2000,
        mockCallbacks,
        'mic',
        'meeting',
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

    it('skips structured summarizer and saves with summaryStatus ready when type=dictation', async () => {
      const { saveMeeting } = await import('@/main/store');
      const { default: summarizer } =
        await import('@/main/pipeline/structured-summarizer');

      const service = transcriberService as any;
      await service.persistMeeting(
        'test text',
        [],
        1000,
        2000,
        mockCallbacks,
        'mic',
        'dictation',
      );

      expect(saveMeeting).toHaveBeenCalledWith(
        expect.objectContaining({ summaryStatus: 'ready' }),
      );
      expect(summarizer.summarize).not.toHaveBeenCalled();
    });

    it('does not auto-call summarizer on persist when type=meeting (enrichment is on-demand)', async () => {
      const { default: summarizer } =
        await import('@/main/pipeline/structured-summarizer');

      const service = transcriberService as any;
      await service.persistMeeting(
        'test text that is long enough',
        [],
        1000,
        2000,
        mockCallbacks,
        'mic',
        'meeting',
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

  describe('resolveCalendarParticipants', () => {
    const matches = [
      {
        id: 'best',
        title: 'Best Overlap',
        overlapMs: 1000,
        participants: [{ name: 'Alice', email: 'alice@example.com' }],
      },
      {
        id: 'other',
        title: 'Other Match',
        overlapMs: 500,
        participants: [{ name: null, email: 'bob@example.com' }],
      },
    ];

    afterEach(() => {
      const service = transcriberService as any;
      service.calendarMatches = [];
      service.calendarMatchDecision = 'pending';
    });

    it('returns [] for dictation-type sessions even if matches are present', () => {
      const service = transcriberService as any;
      service.calendarMatches = matches;
      service.calendarMatchDecision = 'pending';

      expect(service.resolveCalendarParticipants('dictation')).toEqual([]);
    });

    it('returns [] when there are no matches', () => {
      const service = transcriberService as any;
      service.calendarMatches = [];

      expect(service.resolveCalendarParticipants('meeting')).toEqual([]);
    });

    it('defaults to the best-overlap match when the decision is still pending', () => {
      const service = transcriberService as any;
      service.calendarMatches = matches;
      service.calendarMatchDecision = 'pending';

      expect(service.resolveCalendarParticipants('meeting')).toEqual(['Alice']);
    });

    it('returns [] when the user declined', () => {
      const service = transcriberService as any;
      service.calendarMatches = matches;
      service.calendarMatchDecision = 'declined';

      expect(service.resolveCalendarParticipants('meeting')).toEqual([]);
    });

    it("returns the explicitly selected match's participants", () => {
      const service = transcriberService as any;
      service.calendarMatches = matches;
      service.calendarMatchDecision = 'other';

      expect(service.resolveCalendarParticipants('meeting')).toEqual([
        'bob@example.com',
      ]);
    });

    it('persistMeeting includes the resolved participants in the saved meeting', async () => {
      const { saveMeeting } = await import('@/main/store');
      const service = transcriberService as any;
      service.calendarMatches = matches;
      service.calendarMatchDecision = 'pending';

      await service.persistMeeting(
        'test text',
        [],
        1000,
        2000,
        mockCallbacks,
        'mic',
        'meeting',
      );

      expect(saveMeeting).toHaveBeenCalledWith(
        expect.objectContaining({ participants: ['Alice'] }),
      );
    });
  });

  describe('beginSession calendar match lookup', () => {
    afterEach(() => {
      const service = transcriberService as any;
      service.calendarMatches = [];
      service.calendarMatchDecision = 'pending';
      service.sessionActive = false;
      mockCreateCalendarProvider.mockReset();
    });

    it('does not look up the calendar for dictation-type sessions', async () => {
      const { getCalendarPreferences } = await import('@/main/store');
      (getCalendarPreferences as any).mockReturnValue({
        feedUrl: 'https://example.com/feed.ics',
      });

      transcriberService.beginSession(1000, 'dictation');
      await Promise.resolve();

      expect(mockCreateCalendarProvider).not.toHaveBeenCalled();
    });

    it('does not look up the calendar when no feed URL is configured', async () => {
      const { getCalendarPreferences } = await import('@/main/store');
      (getCalendarPreferences as any).mockReturnValue({ feedUrl: '' });

      transcriberService.beginSession(1000, 'meeting');
      await Promise.resolve();

      expect(mockCreateCalendarProvider).not.toHaveBeenCalled();
    });

    it('stores matches and shows the notification when the calendar lookup finds events', async () => {
      const { getCalendarPreferences } = await import('@/main/store');
      const { updateNotificationState } =
        await import('@/main/notification-window');
      (getCalendarPreferences as any).mockReturnValue({
        feedUrl: 'https://example.com/feed.ics',
      });
      const found = [
        {
          id: 'evt-1',
          title: 'Weekly Sync — 2:00 PM',
          overlapMs: 100,
          participants: [{ name: 'Alice', email: 'alice@example.com' }],
        },
      ];
      mockCreateCalendarProvider.mockReturnValue({
        findMatchingEvents: vi.fn().mockResolvedValue(found),
      });

      transcriberService.beginSession(1000, 'meeting');
      await Promise.resolve();
      await Promise.resolve();

      const service = transcriberService as any;
      expect(service.calendarMatches).toEqual(found);
      expect(updateNotificationState).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'calendar-match',
          calendarMatches: [{ id: 'evt-1', title: 'Weekly Sync — 2:00 PM' }],
        }),
      );
    });

    it('discards a stale lookup result from a session that was already restarted', async () => {
      const { getCalendarPreferences } = await import('@/main/store');
      (getCalendarPreferences as any).mockReturnValue({
        feedUrl: 'https://example.com/feed.ics',
      });

      let resolveFirstLookup: (value: any[]) => void = () => {};
      const firstLookup = new Promise<any[]>((resolve) => {
        resolveFirstLookup = resolve;
      });
      mockCreateCalendarProvider.mockReturnValueOnce({
        findMatchingEvents: vi.fn().mockReturnValue(firstLookup),
      });
      mockCreateCalendarProvider.mockReturnValueOnce({
        findMatchingEvents: vi.fn().mockResolvedValue([]),
      });

      // Start session A (its lookup stays pending), then immediately start
      // session B — bumping calendarSessionToken before A resolves.
      transcriberService.beginSession(1000, 'meeting');
      transcriberService.beginSession(2000, 'meeting');
      await Promise.resolve();

      // Late resolution of session A's stale lookup should be discarded.
      resolveFirstLookup([
        {
          id: 'stale-event',
          title: 'Stale',
          overlapMs: 1,
          participants: [],
        },
      ]);
      await Promise.resolve();
      await Promise.resolve();

      const service = transcriberService as any;
      expect(service.calendarMatches).toEqual([]);
    });
  });

  describe('applyModelPreferences', () => {
    afterEach(() => {
      // Reset session state directly — beginSession()/endSession() would
      // pull in the full persist/meeting-detector flow, which is out of
      // scope for this guard test.
      (transcriberService as any).sessionActive = false;
    });

    it('rejects without touching the transcriber when a session is active', async () => {
      const { whisperTranscriber } = await import('@/main/pipeline');
      const { AsrFactory } = await import('@/main/pipeline/asr-factory');
      const service = transcriberService as any;
      service.sessionActive = true;

      const result = await service.applyModelPreferences({
        selectedModel: 'Xenova/whisper-tiny',
        quantized: true,
        multilingual: false,
        language: 'auto',
        asrType: 'whisper',
      });

      expect(result).toEqual({
        success: false,
        message: 'Stop recording before changing the transcription model.',
      });
      expect(whisperTranscriber.initialize).not.toHaveBeenCalled();
      expect(AsrFactory.createTranscriber).not.toHaveBeenCalled();
    });

    it('loads the model when no session is active', async () => {
      const { whisperTranscriber } = await import('@/main/pipeline');
      const service = transcriberService as any;
      service.sessionActive = false;

      const result = await service.applyModelPreferences({
        selectedModel: 'Xenova/whisper-tiny',
        quantized: true,
        multilingual: true,
        language: 'auto',
        asrType: 'whisper',
      });

      expect(result).toEqual({ success: true });
      expect(whisperTranscriber.initialize).toHaveBeenCalledWith(
        'Xenova/whisper-tiny',
        true,
        undefined,
      );
    });
  });

  describe('preloadCurrentModel', () => {
    afterEach(() => {
      (transcriberService as any).sessionActive = false;
    });

    it('reads the current model preferences and eagerly initializes that model at startup', async () => {
      const { whisperTranscriber } = await import('@/main/pipeline');
      const { getModelPreferences } = await import('@/main/store');

      (getModelPreferences as any).mockReturnValueOnce({
        selectedModel: 'Xenova/whisper-tiny',
        quantized: true,
        multilingual: false,
        language: 'auto',
        asrType: 'whisper',
      });

      const service = transcriberService as any;
      service.sessionActive = false;

      const result = await service.preloadCurrentModel();

      expect(result).toEqual({ success: true });
      // multilingual: false means the .en suffix should be applied — this
      // is the exact model the first real transcribe() call in the session
      // would also resolve to, so a matching initialize() call there is a
      // no-op (see whisper-transcriber.test.ts's dedupe test).
      expect(whisperTranscriber.initialize).toHaveBeenCalledWith(
        'Xenova/whisper-tiny.en',
        true,
        undefined,
      );
    });
  });
});
