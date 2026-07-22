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
import type { TranscriberCallbacks } from '../services/transcriber';
import { CHANNELS } from '@/lib/ipc-channels';
import {
  createTranscriberCallbacks,
  resetTranscriberSessionState,
  createSilentAudio,
} from './helpers/transcriberTestHelpers';

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

vi.mock('@/main/pipeline/structured-summarizer', () => ({
  default: {
    summarize: vi.fn(async () => null),
    resetSession: vi.fn(),
    submitChunk: vi.fn(async () => null),
  },
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
const SILENT_AUDIO = createSilentAudio();

// Meeting shape returned by the mocked getMeetingById() when a late segment
// arrives after a meeting was already saved earlier in the session.
function mockExistingMeeting() {
  return {
    id: 'test-meeting',
    transcript: 'first part',
    audioSource: 'mic',
  };
}

type SessionSegment = {
  text: string;
  startedAt: number;
  source: 'mic' | 'system';
};

// Seeds TranscriberService's in-progress session with the given segments and
// ends it — the "begin session, push segments, endSession" sequence shared by
// every test in this file that starts from an already-saved meeting.
async function seedAndEndSession(
  segments: SessionSegment[],
  callbacks: TranscriberCallbacks,
  {
    startedAt = 1000,
    endedAt = 2000,
  }: { startedAt?: number; endedAt?: number } = {},
) {
  transcriberService.beginSession(startedAt);
  const svc = transcriberService as any;
  for (const seg of segments) {
    svc.sessionSegments.push(seg);
    svc.sessionSources.add(seg.source);
  }
  await transcriberService.endSession(endedAt, callbacks);
}

describe('TranscriberService — late segment recovery (integration)', () => {
  const callbacks = createTranscriberCallbacks();

  beforeEach(() => {
    vi.clearAllMocks();
    resetTranscriberSessionState();
  });

  it('creates a meeting from a late segment when the session buffer was empty', async () => {
    const { saveMeeting } = await import('@/main/store');

    // Simulate: model still loading when session ends → empty buffer
    transcriberService.beginSession(1000);
    await transcriberService.endSession(2000, callbacks);

    expect(saveMeeting).not.toHaveBeenCalled();

    // Whisper finishes — segment arrives after session closed
    await transcriberService.transcribe(
      { audio: SILENT_AUDIO, source: 'mic' },
      callbacks,
    );

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
    await seedAndEndSession(
      [{ text: 'first part', startedAt: 1000, source: 'mic' }],
      callbacks,
    );

    // Second transcription arrives after session closed
    (getMeetingById as any).mockReturnValue(mockExistingMeeting());
    vi.clearAllMocks();

    await transcriberService.transcribe(
      { audio: SILENT_AUDIO, source: 'mic' },
      callbacks,
    );

    expect(updateMeeting).toHaveBeenCalledWith(
      'test-meeting',
      expect.objectContaining({ transcript: 'first part transcribed text' }),
    );
    // Same source as the rest of the session — no [Mic]/[Meeting] tag, no audioSource change
    expect(updateMeeting).not.toHaveBeenCalledWith(
      'test-meeting',
      expect.objectContaining({ audioSource: expect.anything() }),
    );
    expect(mockSend).toHaveBeenCalledWith(
      CHANNELS.MEETINGS.SAVED,
      expect.any(Object),
    );
  });

  it('tags a late segment and upgrades audioSource to "both" when its source differs from the saved meeting', async () => {
    const { getMeetingById, updateMeeting } = await import('@/main/store');

    // Session saved with only mic segments
    await seedAndEndSession(
      [{ text: 'first part', startedAt: 1000, source: 'mic' }],
      callbacks,
    );

    // A late SYSTEM segment arrives after the mic-only meeting was already saved
    (getMeetingById as any).mockReturnValue(mockExistingMeeting());
    vi.clearAllMocks();

    await transcriberService.transcribe(
      { audio: SILENT_AUDIO, source: 'system' },
      callbacks,
    );

    expect(updateMeeting).toHaveBeenCalledWith(
      'test-meeting',
      expect.objectContaining({
        transcript: 'first part [Meeting] transcribed text',
        audioSource: 'both',
      }),
    );
  });

  it('drops a late segment that arrives beyond the 60-second recovery window', async () => {
    vi.useFakeTimers();
    const { saveMeeting, updateMeeting } = await import('@/main/store');

    transcriberService.beginSession(1000);
    await transcriberService.endSession(2000, callbacks);

    vi.advanceTimersByTime(70_000);

    await transcriberService.transcribe(
      { audio: SILENT_AUDIO, source: 'mic' },
      callbacks,
    );

    expect(saveMeeting).not.toHaveBeenCalled();
    expect(updateMeeting).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});

describe('TranscriberService — dual-source merge (mic + system)', () => {
  const callbacks = createTranscriberCallbacks();

  beforeEach(() => {
    vi.clearAllMocks();
    resetTranscriberSessionState();
  });

  it('merges mic and system segments into a single tagged transcript when both sources are present', async () => {
    const { saveMeeting } = await import('@/main/store');

    await seedAndEndSession(
      [
        { text: "Alright, let's begin.", startedAt: 1000, source: 'system' },
        { text: 'Sounds good to me.', startedAt: 2000, source: 'mic' },
      ],
      callbacks,
      { endedAt: 3000 },
    );

    expect(saveMeeting).toHaveBeenCalledWith(
      expect.objectContaining({
        transcript: "[Meeting] Alright, let's begin. [Mic] Sounds good to me.",
        audioSource: 'both',
      }),
    );
  });

  it('orders merged segments by timestamp regardless of push order', async () => {
    const { saveMeeting } = await import('@/main/store');

    // Pushed out of chronological order — mic segment (later startedAt) first
    await seedAndEndSession(
      [
        { text: 'second spoken', startedAt: 2000, source: 'mic' },
        { text: 'first spoken', startedAt: 1000, source: 'system' },
      ],
      callbacks,
      { startedAt: 1000, endedAt: 3000 },
    );

    expect(saveMeeting).toHaveBeenCalledWith(
      expect.objectContaining({
        transcript: '[Meeting] first spoken [Mic] second spoken',
        audioSource: 'both',
      }),
    );
  });
});
