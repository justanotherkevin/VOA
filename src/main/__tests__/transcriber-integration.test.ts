/// <reference types="vitest/globals" />
/**
 * Integration tests for TranscriberService late-segment recovery.
 *
 * Exercises the full public API flow (beginSession → endSession → transcribe)
 * to verify that segments arriving after the session closes are not silently
 * dropped, matching the real first-run race condition where Whisper is still
 * loading when endSession flushes an empty buffer.
 */
import transcriberService from '../services/transcriber';
import { CHANNELS } from '@/lib/ipc-channels';

const mockSend = vi.fn();

vi.mock('@/main/store', () => ({
  saveMeeting: vi.fn(() => ({
    id: 'test-meeting',
    title: 'Test Meeting',
    startedAt: 1000,
    endedAt: 2000,
    durationMs: 1000,
    transcript: '',
    chunks: [],
    summary: '',
    summaryStatus: 'ready',
    decisions: [],
    topics: [],
    actionItems: [],
    audioSource: 'mic',
    participants: [],
    tags: [],
  })),
  updateMeeting: vi.fn((id: string, patch: any) => ({ id, ...patch })),
  getMeetingById: vi.fn(() => null),
  getModelPreferences: vi.fn(() => ({
    asrType: 'whisper',
    selectedModel: 'Xenova/whisper-tiny.en',
    multilingual: false,
    quantized: true,
    language: 'auto',
  })),
  generateTitle: vi.fn((text: string) => text.slice(0, 20)),
}));

vi.mock('@/main/state/volatile', () => ({
  getMainWindow: vi.fn(() => ({ webContents: { send: mockSend } })),
}));

vi.mock('@/main/pipeline', () => ({
  whisperTranscriber: {
    initialize: vi.fn(),
    transcribe: vi.fn(async () => ({ text: 'transcribed text', chunks: [] })),
    dispose: vi.fn(),
  },
}));

vi.mock('@/main/pipeline/asr-factory', () => ({
  AsrFactory: { createTranscriber: vi.fn() },
}));

vi.mock('@/main/pipeline/style-transfer', () => ({
  default: { processTranscript: vi.fn() },
}));

vi.mock('@/main/pipeline/structured-summarizer', () => ({
  default: { summarize: vi.fn(async () => null) },
}));

vi.mock('@/main/pipeline/text-cleaner', () => ({
  cleanText: vi.fn((text: string) => text),
}));

vi.mock('@/main/util', () => ({
  pasteTextToActiveWindow: vi.fn(),
  shouldPasteText: vi.fn(() => false),
}));

vi.mock('electron-log', () => ({
  log: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));

// Silent 1-second audio buffer in the format transcribe() expects (plain array)
const SILENT_AUDIO = Array.from(new Float32Array(16000));

describe('TranscriberService — late segment recovery (integration)', () => {
  const callbacks = {
    onUpdate: vi.fn(),
    onProgress: vi.fn(),
    onComplete: vi.fn(),
    onError: vi.fn(),
    onMeetingSaved: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset singleton state between tests
    const svc = transcriberService as any;
    svc.sessionActive = false;
    svc.sessionIsMeeting = false;
    svc.lastSavedMeetingId = null;
    svc.lastSessionMeta = null;
    svc.sessionSegments = [];
    svc.sessionChunks = [];
    svc.sessionSources = new Set();
    svc.sessionStartedAt = null;
  });

  it('creates a meeting from a late segment when the session buffer was empty', async () => {
    const { saveMeeting } = await import('@/main/store');

    // Simulate: model still loading when session ends → empty buffer
    transcriberService.beginSession(1000);
    await transcriberService.endSession(2000, callbacks);

    expect(saveMeeting).not.toHaveBeenCalled();

    // Whisper finishes — segment arrives after session closed
    await transcriberService.transcribe({ audio: SILENT_AUDIO, source: 'mic' }, callbacks);

    expect(saveMeeting).toHaveBeenCalledWith(
      expect.objectContaining({
        transcript: 'transcribed text',
        startedAt: 1000,
        endedAt: 2000,
        audioSource: 'mic',
      }),
    );
    expect(mockSend).toHaveBeenCalledWith(
      CHANNELS.MEETINGS.SAVED,
      expect.objectContaining({ id: 'test-meeting' }),
    );
    // Late path notifies via webContents.send, not the session callback
    expect(callbacks.onMeetingSaved).not.toHaveBeenCalled();
  });

  it('appends a late segment to the meeting when the session already saved one', async () => {
    const { getMeetingById, updateMeeting } = await import('@/main/store');

    // Session with one segment that saves a meeting
    transcriberService.beginSession(1000);
    const svc = transcriberService as any;
    svc.sessionSegments.push({ text: 'first part', startedAt: 1000, source: 'mic' });
    svc.sessionSources.add('mic');
    await transcriberService.endSession(2000, callbacks);

    // Second transcription arrives after session closed
    (getMeetingById as any).mockReturnValue({
      id: 'test-meeting',
      transcript: 'first part',
    });
    vi.clearAllMocks();

    await transcriberService.transcribe({ audio: SILENT_AUDIO, source: 'mic' }, callbacks);

    expect(updateMeeting).toHaveBeenCalledWith(
      'test-meeting',
      expect.objectContaining({ transcript: 'first part transcribed text' }),
    );
    expect(mockSend).toHaveBeenCalledWith(
      CHANNELS.MEETINGS.SAVED,
      expect.any(Object),
    );
  });

  it('drops a late segment that arrives beyond the 60-second recovery window', async () => {
    vi.useFakeTimers();
    const { saveMeeting, updateMeeting } = await import('@/main/store');

    transcriberService.beginSession(1000);
    await transcriberService.endSession(2000, callbacks);

    vi.advanceTimersByTime(70_000);

    await transcriberService.transcribe({ audio: SILENT_AUDIO, source: 'mic' }, callbacks);

    expect(saveMeeting).not.toHaveBeenCalled();
    expect(updateMeeting).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});
